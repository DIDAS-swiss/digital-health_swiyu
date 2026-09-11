/**
 * Demo front-end.
 *
 * Deliberately plain: no framework, no build step. The interesting behaviour is
 * on the server, and a reader following the journey should be able to see what
 * each button does without unpicking a bundle.
 */

const MOCK = window.DEMO_MODE === 'mock';
const PROTECTED_CLAIMS = ['personal_administrative_number'];

const $ = (id) => document.getElementById(id);

async function api(method, path, body) {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `${method} ${path} failed`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

const escape = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function renderError(error) {
  const payload = error.payload || {};
  const reasons = payload.reasons || (payload.findings || []).map((f) => `[${f.rule}] ${f.message}`);
  return `<div class="card">
    <div class="verdict deny">✗ ${escape(payload.error || 'error')}</div>
    <p>${escape(error.message)}</p>
    ${reasons.length ? `<ul class="reasons">${reasons.map((r) => `<li>${escape(r)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

function renderClaims(claims) {
  return `<ul class="claims">${claims
    .map((claim) => {
      const name = Array.isArray(claim) ? claim.join('.') : claim;
      const isProtected = PROTECTED_CLAIMS.includes(String(name).split('.')[0]);
      return `<li class="${isProtected ? 'protected' : ''}" ${
        isProtected ? 'title="protected field — requires an authorization trust marker"' : ''
      }>${escape(name)}</li>`;
    })
    .join('')}</ul>`;
}

function renderDecision(decision) {
  if (!decision) return '';
  const allow = decision.outcome === 'allow';
  return `<div class="verdict ${allow ? 'allow' : 'deny'}">${allow ? '✓ allowed' : '✗ refused'}</div>
    <ul class="reasons">${(decision.reasons || []).map((r) => `<li>${escape(r)}</li>`).join('')}</ul>`;
}

/** A QR code plus, in mock mode, the button that stands in for scanning it. */
function renderOffer(title, result, scanAction) {
  return `<div class="card">
    <h3>${escape(title)}</h3>
    <div class="qr">
      <img src="${result.qr}" alt="QR code for ${escape(title)}">
      <div>
        <p class="deeplink">${escape(result.deeplink || result.credential?.deeplink || '')}</p>
        ${MOCK ? `<button data-scan="${escape(scanAction)}" data-deeplink="${escape(
          result.deeplink || result.credential?.deeplink || '',
        )}">Scan with wallet</button>` : '<p class="why">Scan with the swiyu Sandbox Wallet.</p>'}
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------- wallet */

async function refreshWallet() {
  const container = $('wallet-contents');
  if (!MOCK) {
    container.innerHTML = '<p class="empty">The wallet lives on the patient\'s phone.</p>';
    return;
  }
  const credentials = await api('GET', '/api/wallet/credentials');
  container.innerHTML = credentials.length
    ? credentials
        .map((credential) => {
          const revoked = credential.status !== 0;
          const label = credential.claims.medication
            ? credential.claims.medication.map((m) => m.name).join(', ')
            : credential.claims.insurer_name || credential.claims.laboratory_name || credential.claims.family_name || '';
          return `<div class="vc ${revoked ? 'revoked' : ''}">
            <div>${escape(label)}</div>
            <div class="vct">${escape(credential.vct)}</div>
            <div class="state">${revoked ? (credential.status === 2 ? 'suspended' : 'revoked') : 'valid'}</div>
          </div>`;
        })
        .join('')
    : '<p class="empty">No credentials yet.</p>';
}

async function refreshJournal() {
  const entries = await api('GET', '/api/governance/journal');
  $('result-journal').innerHTML = entries.length
    ? `<table>
        <thead><tr><th>time</th><th>actor</th><th>purpose</th><th>claims</th><th>decision</th></tr></thead>
        <tbody>${entries
          .map(
            (entry) => `<tr>
              <td>${escape(entry.timestamp.slice(11, 19))}</td>
              <td>${escape(entry.actorRole.split('.').pop())}</td>
              <td>${escape(entry.purposeScope)}</td>
              <td>${entry.claimsReleased.length}</td>
              <td class="${entry.decision === 'allow' ? 'ok' : 'deny'}">${escape(entry.decision)}</td>
            </tr>
            <tr><td colspan="5"><ul class="reasons">${entry.reasons
              .map((r) => `<li>${escape(r)}</li>`)
              .join('')}</ul></td></tr>`,
          )
          .join('')}</tbody>
      </table>`
    : '<p class="empty">Nothing has happened yet.</p>';
}

/* ------------------------------------------------- step 1: the insurer */

$('form-insurer').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const body = Object.fromEntries(form.entries());
  body.coverage = ['KVG'];
  try {
    const result = await api('POST', '/api/insurer/insurance-card', body);
    $('result-insurer').innerHTML =
      renderOffer('Insurance card offer', result, 'accept') +
      `<div class="card">${renderDecision({ outcome: result.record.decision, reasons: result.record.reasons })}
        <details><summary>Retention expectation</summary><p class="why">${escape(
          result.record.retention || 'not stated',
        )}</p></details></div>`;
    await refreshJournal();
  } catch (error) {
    $('result-insurer').innerHTML = renderError(error);
  }
});

if (MOCK) {
  $('get-betaid').addEventListener('click', async () => {
    const form = new FormData($('form-insurer'));
    await api('POST', '/api/wallet/beta-id', {
      givenName: form.get('givenName'),
      familyName: form.get('familyName'),
      birthDate: form.get('birthDate'),
      administrativeNumber: form.get('administrativeNumber'),
    });
    await refreshWallet();
  });
  $('clear-wallet').addEventListener('click', async () => {
    await api('DELETE', '/api/wallet/credentials');
    await refreshWallet();
  });
}

/* ------------------------------------------------- step 2: the check-in */

let encounterId = null;

$('start-checkin').addEventListener('click', async () => {
  try {
    const result = await api('POST', '/api/praxis/check-in');
    encounterId = result.encounterId;
    $('result-checkin').innerHTML =
      `<div class="card">
        <h3>What the practice is asking for</h3>
        ${result.requested
          .map(
            (request) => `<p class="why"><code>${escape(request.credentialType)}</code></p>${renderClaims(
              request.claims,
            )}`,
          )
          .join('')}
        <p class="why">Purpose registered as <code>${escape(result.purposeScope)}</code>.</p>
      </div>` + renderOffer('Check-in request', result, 'present');
  } catch (error) {
    $('result-checkin').innerHTML = renderError(error);
  }
});

async function pollCheckIn() {
  if (!encounterId) return;
  const result = await api('GET', `/api/praxis/check-in/${encounterId}`);
  if (result.state === 'PENDING') return;
  const encounter = result.encounter;
  $('result-checkin').innerHTML += `<div class="card">
    <h3>Check-in result</h3>
    ${renderDecision(result.decision)}
    ${
      encounter.patient
        ? `<table><tbody>
            <tr><th>patient</th><td>${escape(
              `${encounter.patient.givenName} ${encounter.patient.familyName}`,
            )} (${escape(encounter.patient.birthDate)})</td></tr>
            <tr><th>insurer</th><td>${escape(encounter.cover?.insurerName || '—')}</td></tr>
            <tr><th>cover</th><td>${escape((encounter.cover?.coverage || []).join(', '))} · ${escape(
              encounter.cover?.insuranceModel || '',
            )}</td></tr>
            <tr><th>card</th><td>${escape(encounter.cover?.cardNumber || '—')}</td></tr>
            <tr><th>AHV</th><td>${escape(encounter.cover?.administrativeNumber || '—')}</td></tr>
          </tbody></table>`
        : ''
    }
  </div>`;
  if (result.decision.outcome === 'allow') {
    $('step-immunization').hidden = false;
    $('step-consultation').hidden = false;
  }
  await refreshJournal();
}

/* ------------------------------------------- step 3: the vaccination */

$('issue-immunization').addEventListener('click', async () => {
  const dose = {
    vaccine_code: '871895005',
    vaccine_name: 'dTpa-IPV combination vaccine',
    target_disease: ['Diphtheria', 'Tetanus', 'Pertussis', 'Poliomyelitis'],
    dose_number: 1,
    doses_in_series: 3,
    lot_number: 'S4021-B',
    route: 'IM',
    site: 'left deltoid',
    next_dose_due: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
  };
  try {
    const result = await api('POST', `/api/praxis/${encounterId}/immunization`, dose);
    $('result-immunization').innerHTML = renderOffer('Immunization record', result, 'accept');
    await showProjections('result-immunization', result.credential.vct, {
      immunization_id: 'IMM-demo',
      patient_given_name: 'DIDAS',
      patient_family_name: 'Patient',
      patient_birth_date: '1988-09-12',
      vaccine_code: dose.vaccine_code,
      vaccine_name: dose.vaccine_name,
      target_disease: dose.target_disease,
      occurrence_date: new Date().toISOString().slice(0, 10),
      dose_number: dose.dose_number,
      doses_in_series: dose.doses_in_series,
      lot_number: dose.lot_number,
      route: dose.route,
      performer_name: 'Dr. med. DIDAS Muster',
      performer_gln: '7601000000001',
      organization_name: 'DIDAS Hausarztpraxis',
      country: 'CH',
    });
    await refreshJournal();
  } catch (error) {
    $('result-immunization').innerHTML = renderError(error);
  }
});

/* ---------------------------------------- step 4: the travel clinic */

let travelVerificationId = null;

$('start-travel').addEventListener('click', async () => {
  try {
    const result = await api('POST', '/api/travel-clinic/check');
    travelVerificationId = result.verificationId;
    $('result-travel').innerHTML =
      `<div class="card"><h3>What the travel clinic is asking for</h3>${renderClaims(
        result.requested[0].claims,
      )}<p class="why">Four claims, against the eighteen the credential holds.</p></div>` +
      renderOffer('Vaccination status request', result, 'present');
  } catch (error) {
    $('result-travel').innerHTML = renderError(error);
  }
});

async function pollTravel() {
  if (!travelVerificationId) return;
  const result = await api('GET', `/api/travel-clinic/check/${travelVerificationId}`);
  if (result.state === 'PENDING') return;
  const imm = result.immunization;
  $('result-travel').innerHTML += `<div class="card">
    <h3>Result</h3>
    ${renderDecision(result.decision)}
    ${
      imm
        ? `<table><tbody>
            <tr><th>protects against</th><td>${escape((imm.target_disease || []).join(', '))}</td></tr>
            <tr><th>given</th><td>${escape(imm.occurrence_date || '—')}</td></tr>
            <tr><th>series</th><td>dose ${escape(imm.dose_number)} of ${escape(imm.doses_in_series)}</td></tr>
          </tbody></table>
          <p class="why">Everything else stayed in the wallet — the clinic never received it.</p>`
        : ''
    }
  </div>`;
  travelVerificationId = null;
  await refreshJournal();
}

/* --------------------------------------------- step 5: the consultation */

$('issue-lab').addEventListener('click', async () => {
  try {
    const result = await api('POST', `/api/praxis/${encounterId}/lab-report`, {
      findings: [
        { loinc_code: '718-7', analyte: 'Haemoglobin', value: '132', unit: 'g/L', reference_range: '120–160', flag: 'NORMAL' },
        { loinc_code: '2093-3', analyte: 'Cholesterol total', value: '6.4', unit: 'mmol/L', reference_range: '< 5.0', flag: 'HIGH' },
        { loinc_code: '14647-2', analyte: 'Cholesterol LDL', value: '4.2', unit: 'mmol/L', reference_range: '< 3.0', flag: 'HIGH' },
      ],
      interpretation: 'Elevated LDL cholesterol. Statin therapy started; review in three months.',
    });
    $('result-consultation').innerHTML += renderOffer('Laboratory report', result, 'accept');
    await showProjections('result-consultation', result.credential.vct, {
      report_id: 'LAB-demo',
      patient_given_name: 'DIDAS',
      patient_family_name: 'Patient',
      findings: [
        { loinc_code: '2093-3', analyte: 'Cholesterol total', value: '6.4', unit: 'mmol/L', reference_range: '< 5.0', flag: 'HIGH' },
      ],
      report_date: new Date().toISOString().slice(0, 10),
      laboratory_name: 'DIDAS Praxislabor',
    });
    await refreshJournal();
  } catch (error) {
    $('result-consultation').innerHTML += renderError(error);
  }
});

$('issue-rx').addEventListener('click', async () => {
  try {
    const result = await api('POST', `/api/praxis/${encounterId}/prescription`, {
      medication: [
        { name: 'Atorvastatin 20 mg', gtin: '7680620930015', dosage: '1 tablet in the evening', quantity: 100, substitution_allowed: true },
      ],
      repeats: 2,
    });
    $('result-consultation').innerHTML += renderOffer('Prescription', result, 'accept');
    await refreshJournal();
  } catch (error) {
    $('result-consultation').innerHTML += renderError(error);
  }
});

/**
 * Show the same claims as a FHIR resource and an openEHR composition.
 * Both are derived views built locally from what the holder released — no CDR,
 * no FHIR server, no shared repository involved.
 */
async function showProjections(containerId, vct, claims) {
  const projection = await api('POST', '/api/projections', { vct, claims });
  $(containerId).innerHTML += `<div class="card">
    <h3>The same data, in the models the sector already uses</h3>
    <p class="why">
      Built locally from the disclosed claims. Derived, never authoritative — the signed credential
      is the evidence — and containing only what the holder actually released.
    </p>
    ${projection.fhir ? `<details><summary>HL7 FHIR</summary><pre>${escape(
      JSON.stringify(projection.fhir.resource, null, 2),
    )}</pre></details>` : ''}
    ${projection.openehr ? `<details><summary>openEHR flat composition (${escape(
      projection.openehr.templateId,
    )})</summary><pre>${escape(JSON.stringify(projection.openehr.composition, null, 2))}</pre></details>` : ''}
  </div>`;
}

/* ---------------------------------------------------- step 4: pharmacy */

let dispenseVerificationId = null;
let dispensedPrescription = null;

$('start-dispense').addEventListener('click', async () => {
  try {
    const result = await api('POST', '/api/pharmacy/dispense');
    dispenseVerificationId = result.verificationId;
    $('result-pharmacy').innerHTML =
      `<div class="card"><h3>What the pharmacy is asking for</h3>${renderClaims(
        result.requested[0].claims,
      )}</div>` + renderOffer('Prescription request', result, 'present');
  } catch (error) {
    $('result-pharmacy').innerHTML = renderError(error);
  }
});

async function pollDispense() {
  if (!dispenseVerificationId) return;
  const result = await api('GET', `/api/pharmacy/dispense/${dispenseVerificationId}`);
  if (result.state === 'PENDING') return;
  const rx = result.prescription;
  dispensedPrescription = rx;
  $('result-pharmacy').innerHTML += `<div class="card">
    <h3>Dispensation</h3>
    ${renderDecision(result.decision)}
    ${
      rx
        ? `<table><thead><tr><th>medication</th><th>dosage</th><th>qty</th></tr></thead><tbody>${(rx.medication || [])
            .map(
              (m) => `<tr><td>${escape(m.name)}</td><td>${escape(m.dosage)}</td><td>${escape(m.quantity)}</td></tr>`,
            )
            .join('')}</tbody></table>
          <button id="confirm-dispense">Hand over and use up the prescription</button>`
        : ''
    }
  </div>`;
  const confirm = $('confirm-dispense');
  if (confirm) {
    confirm.addEventListener('click', async () => {
      const encounters = await api('GET', '/api/praxis/encounters');
      const prescription = encounters
        .flatMap((encounter) => encounter.issued)
        .find((credential) => credential.vct.includes('prescription'));
      if (!prescription) return;
      await api('POST', '/api/pharmacy/confirm', { prescriptionId: prescription.managementId });
      confirm.disabled = true;
      confirm.textContent = 'Prescription used up (revoked)';
      await refreshWallet();
      await refreshJournal();
    });
  }
  dispenseVerificationId = null;
  await refreshJournal();
}

/* ------------------------------------------- wallet "scan" interactions */

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-scan]');
  if (!button) return;
  const deeplink = button.dataset.deeplink;
  button.disabled = true;
  try {
    if (button.dataset.scan === 'accept') {
      await api('POST', '/api/wallet/accept', { deeplink });
      button.textContent = 'Collected into the wallet';
      await refreshWallet();
    } else {
      $('pending').hidden = false;
      $('pending-body').innerHTML = `<p class="why">A verifier is asking for credentials.</p>
        <div class="two">
          <button id="consent-yes">Share</button>
          <button id="consent-no" class="secondary">Decline</button>
        </div>`;
      const answer = (consent) => async () => {
        await api('POST', '/api/wallet/present', { deeplink, consent });
        $('pending').hidden = true;
        await Promise.all([pollCheckIn(), pollDispense(), pollTravel(), refreshWallet()]);
      };
      $('consent-yes').addEventListener('click', answer(true));
      $('consent-no').addEventListener('click', answer(false));
    }
  } catch (error) {
    button.disabled = false;
    button.insertAdjacentHTML('afterend', renderError(error));
  }
});

$('reset').addEventListener('click', async () => {
  await api('POST', '/api/reset');
  if (MOCK) await api('DELETE', '/api/wallet/credentials');
  location.reload();
});

refreshWallet();
refreshJournal();
