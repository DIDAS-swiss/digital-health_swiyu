/**
 * The demo UI.
 *
 * One page that walks the whole journey, because the point of the project is
 * that these are five interactions between four parties and one wallet — not
 * five separate portals. The wallet panel is the second half of the story:
 * every step shows both what an actor asks for and what the holder sees.
 */

import type { AppConfig } from '../config.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

export function renderPage(config: AppConfig): string {
  const mock = config.mode === 'mock';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Digital Health on swiyu</title>
<link rel="stylesheet" href="/static/app.css">
</head>
<body>
<header class="masthead">
  <div class="wrap">
    <h1>Digital Health on the swiyu trust infrastructure</h1>
    <p class="lede">
      A patient checks in at a practice, is vaccinated, and later proves that protection wherever
      it is asked for — with their identity, their cover and their health records held in their own
      wallet as verifiable credentials. No registry in the middle. Swiss Profiles 1.0, swiyu Sandbox.
    </p>
    <div class="badges">
      <span class="badge ${mock ? 'badge-warn' : 'badge-ok'}">mode: ${escapeHtml(config.mode)}</span>
      <span class="badge">trust policy: ${config.trustPolicy.requireVerifiedIdentity ? 'strict' : 'sandbox'}</span>
      <button class="linkish" id="reset">reset demo</button>
    </div>
    ${mock ? `<p class="warn">
      Running against the bundled mock. The business flow and the governance rules are real;
      the cryptography is not — there is no signing, no DPoP, no encryption and no DID resolution.
      Set <code>SWIYU_MODE=sandbox</code> to run the same code against the swiyu Sandbox.
    </p>` : ''}
  </div>
</header>

<main class="wrap layout">
  <div class="journey">

    <section class="step" id="step-insurer">
      <h2><span class="n">1</span> Insurer issues the insurance card</h2>
      <p class="why">
        The health insurer is an issuer. It writes the card data into a credential the patient
        keeps, and retains the ability to revoke it — the status list, not a card reader, is what
        makes cover verifiable later.
      </p>
      <form id="form-insurer" class="grid">
        <label>Given name <input name="givenName" value="Helvetia" required></label>
        <label>Surname <input name="familyName" value="National" required></label>
        <label>Date of birth <input name="birthDate" type="date" value="1988-09-12" required></label>
        <label>AHV number <input name="administrativeNumber" value="756.1234.5678.97" required></label>
        <label>Card number <input name="cardNumber" value="80756000000000000001" required></label>
        <label>Model
          <select name="insuranceModel">
            <option>STANDARD</option><option>HMO</option><option>HAUSARZT</option><option>TELMED</option>
          </select>
        </label>
        <button type="submit">Issue insurance card</button>
      </form>
      <div class="result" id="result-insurer"></div>
    </section>

    <section class="step" id="step-checkin">
      <h2><span class="n">2</span> Check-in at the practice</h2>
      <p class="why">
        One QR code asks for two credentials from two different issuers: identity from the Beta-ID
        and cover from the insurance card. The claim list below is the minimisation decision —
        the practice asks for the AHV number because it bills with it, and for nothing about the
        patient's health.
      </p>
      <button id="start-checkin">Start check-in</button>
      <div class="result" id="result-checkin"></div>
    </section>

    <section class="step showcase" id="step-immunization" hidden>
      <h2><span class="n">3</span> Vaccination — the showcase</h2>
      <p class="why">
        Switzerland already tried the central version of this. <em>meineimpfungen.ch</em> held the
        national electronic vaccination record until it was shut down in 2021 after serious security
        failures, and several hundred thousand people lost access to their own vaccination history
        at once. Here each administered dose is a credential in the patient's wallet: the practice
        attests what it did and then has no further hold over the record, which outlives the
        practice, the platform, and anyone's decision to switch a registry off.
      </p>
      <button id="issue-immunization">Record the dose and issue it</button>
      <div class="result" id="result-immunization"></div>
    </section>

    <section class="step showcase" id="step-travel">
      <h2><span class="n">4</span> Proving protection, and nothing else</h2>
      <p class="why">
        A travel clinic asks whether you are protected. Under its entitlement it may ask for the
        disease and the date — and it <em>cannot</em> obtain the vaccine brand, the batch, the
        clinic or your name, even if its software asks for them. Compare the claim list here with
        the one the practice sent at check-in: same credential, same wallet, a fraction of the data.
        A paper vaccination booklet handed across a counter cannot do this.
      </p>
      <button id="start-travel">Check vaccination protection</button>
      <div class="result" id="result-travel"></div>
    </section>

    <section class="step" id="step-consultation" hidden>
      <h2><span class="n">5</span> The rest of the consultation</h2>
      <p class="why">
        The same pattern applied to findings and to a prescription. The practice keeps its treatment
        record; the patient keeps credentials they can present anywhere, without asking the practice
        for permission.
      </p>
      <div class="two">
        <button id="issue-lab">Issue laboratory report</button>
        <button id="issue-rx">Issue prescription</button>
      </div>
      <div class="result" id="result-consultation"></div>
    </section>

    <section class="step" id="step-pharmacy">
      <h2><span class="n">6</span> Pharmacy dispenses</h2>
      <p class="why">
        The pharmacy verifies the prescription, hands over the medication, and asks the issuing
        practice to revoke it. Redemption is a status change on a list anyone can check — which is
        what stops the same prescription being filled twice, without a central register of who was
        prescribed what.
      </p>
      <button id="start-dispense">Scan prescription</button>
      <div class="result" id="result-pharmacy"></div>
    </section>

    <section class="step" id="step-journal">
      <h2><span class="n">7</span> Governance journal</h2>
      <p class="why">
        What each actor has to be able to show afterwards: who asked, for what purpose, under which
        entitlement, what the holder released and what was decided. Note what is absent — the claim
        <em>values</em>. The journal proves the interaction was within the rules without becoming a
        second copy of the patient's data.
      </p>
      <div class="result" id="result-journal"></div>
    </section>
  </div>

  <aside class="wallet-panel">
    <h2>Patient wallet</h2>
    ${mock ? `<p class="why">
      Standing in for the swiyu Sandbox Wallet on a phone. "Scan" replaces pointing a camera at the
      QR code; everything else — selective disclosure, consent, status checks — behaves as the real
      wallet does.
    </p>
    <div class="two">
      <button id="get-betaid" class="secondary">Get a Beta-ID</button>
      <button id="clear-wallet" class="secondary">Empty wallet</button>
    </div>` : `<p class="why">
      Open the QR codes with the swiyu <strong>Sandbox</strong> Wallet
      (<a href="https://apps.apple.com/us/app/swiyu-sandbox-wallet/id6771296857">iOS</a>,
      <a href="https://github.com/swiyu-admin-ch/eidch-android-wallet/releases">Android</a>).
      The production swiyu Wallet will refuse: CD-001 separates the two environments.
      Get a Beta-ID from the
      <a href="https://www.bcs.admin.ch/bcs-web">Beta Credential Service</a>.
    </p>`}
    <div id="wallet-contents"></div>
    <div id="pending" class="pending" hidden>
      <h3>Awaiting your response</h3>
      <div id="pending-body"></div>
    </div>
  </aside>
</main>

<footer class="wrap">
  <p>
    <a href="https://github.com/DIDAS-swiss/digital-health_swiyu">DIDAS-swiss/digital-health_swiyu</a>
    · Swiss Profiles
    <code>swiss-profile-issuance:1.0.0</code>, <code>swiss-profile-verification:1.0.0</code>,
    <code>swiss-profile-vc:1.0.0</code>, <code>swiss-profile-anchor:1.0.0</code>
  </p>
</footer>

<script>window.DEMO_MODE = ${JSON.stringify(config.mode)};</script>
<script src="/static/app.js" type="module"></script>
</body>
</html>`;
}
