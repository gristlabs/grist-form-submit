/**
 Usage: Add the following snippet at the end of the CF7 form template:

========================================
<script src="URL_TO_THIS_SCRIPT"
  data-grist-doc="GRIST_DOC_URL"
  data-grist-table="GRIST_TABLE_ID"
></script>
========================================

 */

async function handleSubmit(ev) {
  const formId = ev.detail.contactFormId;
  const docUrl = ev.target.querySelector('[data-grist-doc]')?.getAttribute('data-grist-doc');
  const tableId = ev.target.querySelector('[data-grist-table]')?.getAttribute('data-grist-table');
  if (!docUrl) {
    console.log("Grist-WPCF7: form %s missing attribute data-grist-doc='GRIST_DOC_URL'", formId);
    return;
  }
  if (!tableId) {
    console.log("Grist-WPCF7: form %s missing attribute data-grist-table='GRIST_TABLE_ID'", formId);
    return;
  }

  // Pick out the server and docId from the docUrl.
  const match = /^(https?:\/\/[^\/]+(?:\/o\/[^\/]+)?)\/(?:doc\/([^\/?#]+)|([^\/?#]{12,})\/)/.exec(docUrl);
  if (!match) {
    console.log("Grist-WPCF7: form %s invalid Grist doc URL: %s", formId, docUrl);
    return;
  }
  const server = match[1];
  const docId = match[2] || match[3];

  // Construct the URL to use for the add-record API endpoint.
  const destUrl = server + "/api/docs/" + docId + "/tables/" + tableId + "/records";

  const payload = formDataToJson(new FormData(ev.target));
  const options = {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({records: [{fields: payload}]}),
  };

  const resp = await window.fetch(destUrl, options);

  if (resp.status === 200) {
    console.log("Grist-WPCF7: added record");
  } else {
    // Try our best to report a helpful error.
    console.warn("Grist-WPCF7: Failed to add record via %s:", docUrl, resp.status, resp.statusText);
    let body = '';
    try { body = await resp.json(); } catch (e) {}
    let match;
    if (typeof body.error === 'string' && (match = /KeyError '(.*)'/.exec(body.error))) {
      console.warn('Grist-WPCF7: No column "%s" in table "%s". ' +
        'Be sure to use column ID rather than column label',
        match[1], tableId);
    } else {
      console.warn("Grist-WPCF7: Error:", body.error || body);
    }
  }
}

function formDataToJson(f) {
  const keys = Array.from(f.keys()).filter(k => !k.startsWith("_"));
  return Object.fromEntries(keys.map(k =>
    k.endsWith('[]') ? [k.slice(0, -2), ['L', ...f.getAll(k)]] : [k, f.get(k)]));
}

// With multiple forms on a page, the script may be loaded multiple times, but we only register
// a handler once, at the document level.
if (!window.grist_wpcf7_loaded) {
  window.grist_wpcf7_loaded = true;
  document.addEventListener('wpcf7mailsent', handleSubmit);
}
