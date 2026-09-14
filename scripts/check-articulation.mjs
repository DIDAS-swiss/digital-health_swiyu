#!/usr/bin/env node
/**
 * Hold the public prose to the articulation rule.
 *
 *     node scripts/check-articulation.mjs          # check
 *     node scripts/check-articulation.mjs --list   # print what is flagged
 *     node scripts/check-articulation.mjs --accept # record the current set as reviewed
 *
 * The rule is defined in docs/writing-standard.md: every statement should
 * identify the object or data under discussion, the
 * actor performing the action, the mechanism producing the result, what
 * conclusion follows and what conclusion does not. A protocol property is not a
 * human, legal, clinical or business conclusion.
 *
 * Certain words carry that risk. "Verified" without an object, "trust" as a
 * bare verb, "only" and "never" outside a mechanism statement, "consent" for
 * what is a wallet confirmation, "identity" where the mechanism establishes
 * possession of a credential, "unlinkable" without a correlation surface.
 *
 * This finds the sentences that use them, and compares that set against
 * scripts/articulation-accepted.json, which records the ones already reviewed
 * and the category under which each was accepted. A sentence that is neither
 * accepted nor rewritten fails the check, so new prose gets the same reading
 * the pass gave the existing prose.
 *
 * Accepting is a judgement, not a suppression. --accept rewrites the file from
 * the current state, so the diff shows a reviewer exactly which new sentences
 * an author decided were fine.
 *
 * WHAT THIS IS NOT
 *
 * This is a review gate and not semantic validation. It matches words and
 * neighbouring words. It cannot tell whether a statement is true, whether the
 * actor named is the one that performs the action, or whether a conclusion
 * follows from the mechanism described. A green run means every sentence
 * carrying a watched word has been read by a person and recorded, and nothing
 * more than that. It does not mean the prose is correct.
 *
 * The regexes named SAFE_* are aids for keeping the flagged set readable. They
 * are not evidence that the sentences they exempt are accurate. A pattern that
 * exempts a sentence for mentioning a topic word rather than for naming the
 * basis of its claim is a bug, and two of them were exactly that: SAFE_INTEROP
 * exempted any sentence containing "profile" or "standard", and SAFE_STRONG any
 * sentence containing "specification".
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ACCEPTED = join(ROOT, 'scripts', 'articulation-accepted.json');

// Bump this whenever docs/writing-standard.md changes in a way that could make a
// previously accepted sentence unacceptable. Every entry recorded under an older
// version is then reported as needing re-review, so a stricter standard is not
// silently grandfathered away by acceptances made under a looser one. Re-reviewing
// means reading the sentences again; --accept alone does not clear it, and refuses
// to when the version has moved.
const STANDARD_VERSION = '2026-09-13-2';

const FILES = [
  'site/index.html',
  'README.md',
  // writing-standard.md is the definition of this rule and quotes the wording it
  // bans, so it is the one document the rule cannot be applied to.
  ...readdirSync(join(ROOT, 'docs')).filter((f) => f.endsWith('.md') && f !== 'writing-standard.md')
    .sort().map((f) => `docs/${f}`),
  // docs/credentials/ is generated from the credential definitions, and generated
  // prose is still prose: a template or an issuerBasis string reaches a reader
  // through it. Reading it here means a defect in the generator is caught in the
  // output it produces rather than only where someone happens to look.
  ...readdirSync(join(ROOT, 'docs', 'credentials')).filter((f) => f.endsWith('.md')).sort()
    .map((f) => `docs/credentials/${f}`),
  ...readdirSync(join(ROOT, 'flows')).filter((f) => f.endsWith('.md')).sort().map((f) => `flows/${f}`),
  // The LikeC4 model carries the step notes that the rendered diagrams and the
  // flow documents both draw on, so the notes are public prose under a file
  // extension the earlier list did not reach.
  ...readdirSync(join(ROOT, 'flows', 'likec4')).filter((f) => f.endsWith('.likec4')).sort()
    .map((f) => `flows/likec4/${f}`),
];

// A sentence is risky when it uses one of these and the surrounding words do
// not already supply the missing precision.
const SAFE_TRUST = /trust (registry|registries|infrastructure|statement|statements|marker|markers|protocol|anchor|anchors|domain|list|lists|ecosystem|flow|flows|policy|policies|chain)|Trust Protocol|trust-|swiyu Trust/i;
const VERIFY_OBJECT = /verif\w+\s+(the\s+)?(signature|issuer|status|holder|binding|presentation|credential|proof|token|key|identity attribute|source|claim)|(signature|issuer|status|holder binding|presentation|credential)\s+\w{0,12}\s?verif/i;
const SAFE_VERIFY = /verifier|verifiable|swiss-profile-verification|source verification|verification query|\/verifications|verification path|VERIFIERS/i;
const SAFE_ONLY = /read-?only|only when|only if|only one|only two|only three|only four|only five|only six|only seven|only eight|only nine|only ten|only the (first|second|last)/i;
const SAFE_PROTECTED = /protected (claim|field|fields|verification|issuance)|protected under/i;
const SAFE_PROVE = /proof of possession|proof element|zero-knowledge|predicate proof/i;
const SAFE_IDENTITY = /identity (credential|attribute|provider|trust marker|verification service)|Beta-ID|e-ID|identity onboarding/i;
const SAFE_PRIVATE = /private key|private organisation|private sector|private entit|private practice/i;
const SAFE_CONSENT = /research consent|standing-authorisation|legal consent|clinical consent|consent credential|Human Research/i;

// --- rules 3, 4, 7 and 9 of docs/writing-standard.md ------------------------
//
// Each of these is mechanical enough to catch by pattern. The rest of the
// standard is not, which is why the accepted file records a human decision per
// sentence rather than a suppression list.

// Rule 3. Promotional adjectives, used only where the text defines the property
// or cites its basis. "Secure" keeps its own category, which predates this.
const PROMOTIONAL = /\b(privacy[- ]preserving|trustworthy|robust|seamless|powerful|innovative|resilient|state[- ]of[- ]the[- ]art|cutting[- ]edge|world[- ]class)\b/i;
// "Interoperable" is promotional as a bare adjective and factual when the
// sentence says interoperable with what. The exemption is tied to that, and not
// to the sentence merely mentioning a profile or a standard: an earlier version
// exempted any sentence containing "profile", "standard" or a code span, which
// covered most of the repository and exempted the claim rather than the basis.
const PROMO_INTEROP = /\binteroperable\b/i;
const SAFE_INTEROP = /interoperable (with|at|through|to the extent|for)\b/i;

// Rule 4. An agentless subject where an actor should be named.
// The verb has to be an action. "The infrastructure is operated by FOITT" names
// its actor; "the infrastructure supports it" does not.
const AGENTLESS = /\b(the system|the infrastructure|the platform|the technology|the solution)\s+(?!is\b|was\b|has\b|have\b|had\b|does\b|will be\b)\w+s\b|\btrust is established\b|\btrust is created\b/i;

// Rule 7. Pedagogical filler.
const FILLER = /\b(this is important because|what this means is|the key point here is|this is the beauty of|it is worth noting that|it should be noted that|as we have seen|in other words, this)\b/i;

// Rule 9. Words that assert a normative or absolute source. Permitted where the
// sentence names the specification, the law or the enforced constraint behind
// them; the sweep decides the rest.
const STRONG = /\b(guaranteed|impossible|prohibited|cannot happen|by definition)\b/i;
// The exemption is a citation, not a topic word. "Specification" and "the
// profile" were in this list and exempted any sentence that mentioned one, which
// is the opposite of requiring a source: the sentence has to name the clause,
// document or statute it rests on.
const SAFE_STRONG = /\bMUST\b|\bSHOULD\b|\bMAY\b|NOT SUPPORTED|swiss-profile-\w+:\d|trust-protocol|RFC ?\d{3,}|draft-\d|BGEID|ZertES|KVG|MedBG|LPMéd|EpG|HMG|LPTh|\bOR \d|Art\.? ?\d|Article \d/i;

function strip(text, path) {
  if (path.endsWith('.html')) {
    // The disclosure explorer renders its copy from string literals in a script
    // block, so those strings are public prose and the rule applies to them.
    // The code around them is not: an identifier or a comment that happens to
    // use a watched word states nothing about the system. Each script block is
    // therefore reduced to its string literals, of which the single-word ones
    // are dropped as identifiers, keys and class names, and each survivor is
    // terminated so two adjacent literals do not splice into a run-on sentence.
    text = text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g, (_, body) =>
      ' ' + (body.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g) ?? [])
              .map((lit) => lit.slice(1, -1).trim())
              .filter((lit) => /\s/.test(lit) && /[a-z]{3}/i.test(lit))
              .map((lit) => (/[.:;!?]$/.test(lit) ? lit : `${lit}.`))
              .join(' ') + ' ');
    text = text.replace(/<svg\b[\s\S]*?<\/svg>/g, ' ')
               .replace(/<style\b[\s\S]*?<\/style>/g, ' ')
               .replace(/<pre\b[\s\S]*?<\/pre>/g, ' ')
               .replace(/<[^>]+>/g, ' ');
  } else if (path.endsWith('.likec4')) {
    // The prose in the model is the note blocks. Element names, titles and
    // technology strings around them are labels rather than statements.
    text = (text.match(/'''[\s\S]*?'''/g) ?? []).map((n) => n.slice(3, -3)).join('\n\n');
  } else {
    text = text.replace(/^---\n[\s\S]*?\n---\n/, '');
    // A mermaid block is a fenced code block that renders as a picture, so its
    // node labels and notes are prose a reader sees. Other fenced blocks are
    // code and shell transcripts and are dropped. Labels are read; the arrows,
    // participant ids and directives around them are not.
    text = text.replace(/```mermaid\n([\s\S]*?)```/g, (_, body) => {
      const labels = [];
      for (const m of body.matchAll(/\[\s*"([^"]+)"\s*\]|\{\s*"([^"]+)"\s*\}|\(\s*"([^"]+)"\s*\)/g)) {
        labels.push(m[1] ?? m[2] ?? m[3]);
      }
      for (const m of body.matchAll(/^\s*Note (?:over|left of|right of) [^:]+:\s*(.+)$/gm)) labels.push(m[1]);
      for (const m of body.matchAll(/^\s*[\w-]+\s*-*>>?\s*[\w-]+\s*:\s*(.+)$/gm)) labels.push(m[1]);
      return ' ' + labels
        .map((l) => l.replace(/<br\s*\/?>/g, ' ').replace(/\s+/g, ' ').trim())
        .filter((l) => /\s/.test(l) && /[a-z]{3}/i.test(l))
        .map((l) => (/[.:;!?]$/.test(l) ? l : `${l}.`))
        .join(' ') + ' ';
    });
    text = text.replace(/```[\s\S]*?```/g, ' ');
  }
  return text.replace(/`[^`]*`/g, ' CODE ')
             .replace(/https?:\/\/\S+/g, ' URL ')
             .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
}

function sentences(text) {
  return text.replace(/\s+/g, ' ').split(/(?<=[.:;!?])\s+(?=[A-Z*\-|])/)
             .map((s) => s.trim()).filter(Boolean);
}

function risks(s) {
  const out = [];
  if (/\b(prove|proves|proved|proving|proof|proofs)\b/i.test(s) && !SAFE_PROVE.test(s)) out.push('prove');
  if (/\bverif\w+/i.test(s.replace(SAFE_VERIFY, ' ')) && !VERIFY_OBJECT.test(s)) out.push('verify-no-object');
  if (/\btrust(s|ed|worthy)?\b/i.test(s.replace(SAFE_TRUST, ' '))) out.push('trust-bare');
  const noSafeOnly = s.replace(SAFE_ONLY, ' ');
  if (/\b(never|always|guarantee\w*|nothing else|the same person|only)\b/i.test(noSafeOnly)) out.push('absolute');
  if (/\b(identity|identities)\b/i.test(s) && !SAFE_IDENTITY.test(s)) out.push('identity');
  if (/\b(protected|protection|protects)\b/i.test(s) && !SAFE_PROTECTED.test(s)) out.push('protected');
  if (/\b(private|privacy)\b/i.test(s) && !SAFE_PRIVATE.test(s)) out.push('privacy');
  if (/\b(secure|security|securely)\b/i.test(s)) out.push('secure');
  if (/\b(anonymous|anonymity|anonymised|anonymized)\b/i.test(s)) out.push('anonymous');
  if (/\b(consent|consents|consented)\b/i.test(s) && !SAFE_CONSENT.test(s)) out.push('consent');
  if (PROMOTIONAL.test(s)) out.push('promotional');
  if (PROMO_INTEROP.test(s) && !SAFE_INTEROP.test(s)) out.push('promotional');
  if (AGENTLESS.test(s)) out.push('agentless');
  if (FILLER.test(s)) out.push('filler');
  if (STRONG.test(s) && !SAFE_STRONG.test(s)) out.push('strong-claim');
  if (/\b(unlinkable|unlinkability|linkable|linkability)\b/i.test(s) &&
      !/credential identifier|holder key|claim values|status-list reference|timing|network metadata|correlation surface/i.test(s)) {
    out.push('linkability-no-surface');
  }
  return out;
}

function fingerprint(file, sentence) {
  return createHash('sha256').update(`${file}\0${sentence}`).digest('hex').slice(0, 16);
}

const flagged = [];
for (const path of FILES) {
  const full = join(ROOT, path);
  if (!existsSync(full)) continue;
  for (const s of sentences(strip(readFileSync(full, 'utf8'), path))) {
    const r = risks(s);
    if (r.length) flagged.push({ id: fingerprint(path, s), file: path, risk: r, sentence: s });
  }
}

const accepted = existsSync(ACCEPTED) ? JSON.parse(readFileSync(ACCEPTED, 'utf8')) : { reviewed: {} };
const args = process.argv.slice(2);
const staleStandard = accepted.standard_version !== STANDARD_VERSION;

if (args.includes('--accept')) {
  if (staleStandard && !args.includes('--reviewed-against-current-standard')) {
    console.log(
      `The acceptance record was made against standard ${accepted.standard_version ?? '(none)'} and ` +
      `the current standard is ${STANDARD_VERSION}.\n\n` +
      'Every accepted sentence has to be read again against the changed standard before the record\n' +
      'is rewritten, because an acceptance made under a looser rule is not evidence under a stricter\n' +
      'one. Read them with --list, rewrite what the new rules reject, then re-run with\n' +
      '--reviewed-against-current-standard to confirm the reading actually happened.',
    );
    process.exit(1);
  }
  // The risk set recorded is the one the sentence carries now, because --accept
  // asserts that the currently flagged set has been read. Carrying an older risk
  // string forward would leave the record claiming a reading that did not happen.
  const reviewed = {};
  for (const f of flagged) {
    reviewed[f.id] = { file: f.file, risk: f.risk.join(','), sentence: f.sentence.slice(0, 160) };
  }
  writeFileSync(
    ACCEPTED,
    JSON.stringify({ note: accepted.note, standard_version: STANDARD_VERSION, reviewed }, null, 1) + '\n',
  );
  console.log(`Recorded ${Object.keys(reviewed).length} reviewed sentences against standard ${STANDARD_VERSION}.`);
  process.exit(0);
}

// A sentence is identified by its text, so an unchanged sentence keeps its
// acceptance when a rule is added. That is the grandfathering hole: the reader
// who accepted it never saw the new category. An acceptance therefore holds only
// while the risk set it was accepted under is still the risk set the sentence
// carries. A sentence that trips a newly added rule comes back for reading.
const unreviewed = flagged.filter((f) => !accepted.reviewed[f.id]);
const riskChanged = flagged.filter((f) => {
  const a = accepted.reviewed[f.id];
  return a && a.risk !== undefined && a.risk !== f.risk.join(',');
});

if (args.includes('--list')) {
  for (const f of flagged) {
    const mark = accepted.reviewed[f.id] ? ' ' : '!';
    console.log(`${mark} ${f.file}  [${f.risk.join(',')}]\n    ${f.sentence.slice(0, 150)}`);
  }
}

console.log(`${flagged.length} sentences use a word the articulation rule watches; ` +
  `${flagged.length - unreviewed.length} reviewed, ${unreviewed.length} not.`);

if (staleStandard) {
  console.log(
    `\nThe acceptance record names standard ${accepted.standard_version ?? '(none)'}; ` +
    `the current standard is ${STANDARD_VERSION}.`,
  );
}

if (riskChanged.length) {
  console.log(`\n${riskChanged.length} accepted sentences now carry a different risk set:`);
  for (const f of riskChanged.slice(0, 40)) {
    console.log(`  - ${f.file} [${accepted.reviewed[f.id].risk} -> ${f.risk.join(',')}]`);
    console.log(`      ${f.sentence.slice(0, 150)}`);
  }
  if (riskChanged.length > 40) console.log(`  … and ${riskChanged.length - 40} more`);
  console.log('\nEach was accepted under the earlier set. Read it against the rule it now trips.');
}

if (staleStandard || riskChanged.length) process.exitCode = 1;

if (unreviewed.length) {
  console.log();
  console.log('Not yet reviewed:');
  for (const f of unreviewed.slice(0, 40)) {
    console.log(`  - ${f.file} [${f.risk.join(',')}]`);
    console.log(`      ${f.sentence.slice(0, 150)}`);
  }
  if (unreviewed.length > 40) console.log(`  … and ${unreviewed.length - 40} more`);
  console.log();
  console.log('Rewrite the sentence, or record it as reviewed with:');
  console.log('  node scripts/check-articulation.mjs --accept');
  console.log('See docs/writing-standard.md for the rule and the categories.');
  process.exit(1);
}

console.log('Every flagged sentence has been through the articulation rule.');
