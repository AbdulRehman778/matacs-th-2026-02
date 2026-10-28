"use strict";

// Rules half of the triage tool. Facts come from the extraction prompt.
// This file does not call a model and does not rank from prose.

const fs = require("fs");
const path = require("path");

const root = __dirname;
const criteriaDoc = JSON.parse(fs.readFileSync(path.join(root, "criteria.json"), "utf8"));
const proposals = JSON.parse(fs.readFileSync(path.join(root, "extractions.json"), "utf8"));
const criteria = criteriaDoc.criteria;

const weightTotal = criteria
  .filter((item) => item.type === "weighted")
  .reduce((sum, item) => sum + item.weight, 0);

if (weightTotal !== 100) {
  throw new Error("Weighted criteria must sum to 100. They sum to " + weightTotal + ".");
}

const injectionPhrases = [
  "rank it first",
  "assign full marks",
  "note to automated review",
];

function hasInjection(text) {
  const lower = text.toLowerCase();
  return injectionPhrases.some((phrase) => lower.includes(phrase));
}

function quoteInText(text, evidence) {
  return typeof evidence === "string" && evidence.length > 0 && text.includes(evidence);
}

function accept(text, fact, requireQuote) {
  if (fact == null || fact.value == null) {
    return { value: null, ok: !requireQuote };
  }
  if (requireQuote && !quoteInText(text, fact.evidence)) {
    return { value: null, ok: false };
  }
  return { value: fact.value, ok: true };
}

function scoreOne(id, values) {
  const item = criteria.find((criterion) => criterion.id === id);

  if (item.method === "points_per_count") {
    if (values.installs == null) return 0;
    return Math.min(item.cap, values.installs * item.points_per);
  }

  if (item.method === "lower_is_better_between") {
    const price = values.price_cad;
    if (price == null || price > item.zero_at) return 0;
    if (price <= item.full_marks_at) return 100;
    const span = item.zero_at - item.full_marks_at;
    return Math.round(((item.zero_at - price) / span) * 100);
  }

  if (item.method === "shorter_weeks_steps") {
    const weeks = values.weeks;
    if (weeks == null || weeks > item.zero_above) return 0;
    if (weeks <= item.full_marks_at_or_below) return 100;
    const extra = weeks - item.full_marks_at_or_below;
    return 100 - extra * item.drop_per_week_after_full_marks;
  }

  if (item.method === "two_part_years") {
    let total = 0;
    for (const part of item.parts) {
      const years = values[part.field];
      if (years == null || years <= 0) continue;
      const ratio = Math.min(1, years / part.full_marks_years);
      total += ratio * part.points;
    }
    return Math.round(total);
  }

  if (item.method === "checklist") {
    const each = 100 / item.items.length;
    return item.items.reduce((sum, key) => sum + (values[key] === true ? each : 0), 0);
  }

  throw new Error("Unknown scoring method: " + item.method);
}

function weightedTotal(parts) {
  const sum = criteria
    .filter((item) => item.type === "weighted")
    .reduce((total, item) => total + parts[item.id] * item.weight, 0);
  return Math.round(sum) / 100;
}

function ordinal(n) {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return n + "th";
  if (n % 10 === 1) return n + "st";
  if (n % 10 === 2) return n + "nd";
  if (n % 10 === 3) return n + "rd";
  return n + "th";
}

function hold(letter, status, reason) {
  return { proposal: letter, rank: null, status, score: null, reason };
}

function evaluate(proposal) {
  if (hasInjection(proposal.text)) {
    return hold(
      proposal.proposal,
      "flagged",
      "Flagged and not scored: the text tells an automated reviewer how to rank it or what marks to give."
    );
  }

  const text = proposal.text;
  const mandatory = [
    ["Ontario electrical contractor licence held by the bidder", proposal.facts.licence_pass],
    ["WSIB clearance and $5M liability insurance", proposal.facts.insurance_pass],
  ];

  const unknown = [];
  const failed = [];
  for (const [name, fact] of mandatory) {
    const result = accept(text, fact, true);
    if (!result.ok || result.value == null) unknown.push(name);
    else if (result.value === false) failed.push(name);
  }

  if (unknown.length > 0) {
    return hold(
      proposal.proposal,
      "flagged",
      "Flagged and not scored: a mandatory check could not be confirmed from the proposal text (" +
        unknown.join("; ") +
        ")."
    );
  }

  if (failed.length > 0) {
    return hold(
      proposal.proposal,
      "ineligible",
      "Ineligible: failed a mandatory check (" + failed.join("; ") + ")."
    );
  }

  const values = {};
  const numbers = [
    "installs",
    "price_cad",
    "weeks",
    "panel_warranty_years",
    "workmanship_warranty_years",
  ];

  for (const key of numbers) {
    const fact = proposal.facts[key];
    const result = accept(text, fact, fact != null && fact.value != null);
    if (!result.ok) {
      return hold(
        proposal.proposal,
        "flagged",
        "Flagged and not scored: the quote for " + key + " was not found in the proposal text."
      );
    }
    values[key] = result.value;
  }

  for (const key of ["named_lead", "crew", "safety_plan", "monitoring_plan"]) {
    const fact = proposal.facts[key];
    if (fact.value === true) {
      const result = accept(text, fact, true);
      if (!result.ok) {
        return hold(
          proposal.proposal,
          "flagged",
          "Flagged and not scored: the quote for " + key + " was not found in the proposal text."
        );
      }
      values[key] = true;
    } else {
      values[key] = false;
    }
  }

  const parts = {};
  for (const item of criteria) {
    if (item.type === "weighted") parts[item.id] = scoreOne(item.id, values);
  }

  return {
    proposal: proposal.proposal,
    rank: null,
    status: "ranked",
    score: weightedTotal(parts),
    reason: null,
    parts,
    price: values.price_cad == null ? Number.POSITIVE_INFINITY : values.price_cad,
    weeks: values.weeks == null ? Number.POSITIVE_INFINITY : values.weeks,
  };
}

const evaluated = proposals.map(evaluate);
const ranked = evaluated.filter((row) => row.status === "ranked");
const held = evaluated.filter((row) => row.status !== "ranked");

ranked.sort((a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  if (a.price !== b.price) return a.price - b.price;
  if (a.weeks !== b.weeks) return a.weeks - b.weeks;
  return a.proposal.localeCompare(b.proposal);
});

for (let i = 0; i < ranked.length; i++) {
  const row = ranked[i];
  const rank = i + 1;
  const parts = row.parts;
  row.rank = rank;
  row.reason =
    "Ranked " + ordinal(rank) + " with " + row.score.toFixed(2) +
    ": both mandatory checks passed (experience " + parts.experience +
    ", price " + parts.price +
    ", timeline " + parts.timeline +
    ", warranty " + parts.warranty +
    ", team " + parts.team + ").";
}

const output = ranked.concat(held).map((row) => ({
  proposal: row.proposal,
  rank: row.rank,
  status: row.status,
  score: row.score,
  reason: row.reason,
}));

const destination = path.join(root, "..", "ranking.json");
fs.writeFileSync(destination, JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(JSON.stringify(output, null, 2));
