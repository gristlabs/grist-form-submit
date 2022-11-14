import {assert, driver, enableDebugCapture, WebElement} from 'mocha-webdriver';
import {setAttribute, startServer, waitToPass} from './util';

describe('test-plain-form', function() {
  this.timeout(30000);
  enableDebugCapture();

  let url: string;
  let shutdown = () => {};

  before(async function() {
    ({url, shutdown} = await startServer());
  });

  after(async function() {
    shutdown();
  });

  it('should report errors for misconfiguration', async function() {
    await driver.get(`${url}/fixtures/plain-form.html`);
    await driver.find('.test-name').sendKeys('NAME1');

    const form = await driver.find('.test-form');
    const submit = await driver.find('.test-submit');

    async function checkErrorWithReplacedAttr(elem: WebElement, attrName: string, value: string, pattern: RegExp) {
      await withReplacedAttr(elem, attrName, value, async () => {
        await submit.click();
        await waitToPass(async () => {
          assert.match(await submit.getAttribute('validationMessage'), pattern);
        });
      });
      await resetValidity(submit);
    }

    await checkErrorWithReplacedAttr(form, 'data-grist-doc', 'about:blank',
      /Form misconfigured: Invalid Grist doc URL/);

    // Too bad message is about access rules because it we don't have access to know the table doesn't exist.
    await checkErrorWithReplacedAttr(form, 'data-grist-table', 'TableX',
      /Form misconfigured: Failed to add/);

    await checkErrorWithReplacedAttr(form, 'data-grist-success-url', '',
      /Form misconfigured: Missing attribute data-grist-success-url/);

    await checkErrorWithReplacedAttr(driver.find('.test-name'), 'name', 'Nombre',
      /Form misconfigured: .*Invalid column "Nombre"/);
  });

  it('should submit successfully', async function() {
    const randomName = Array.from(Array(8), () => Math.floor(Math.random() * 36).toString(36)).join('');
    const randomYear = Math.floor(Math.random() * 10000);
    await driver.get(`${url}/fixtures/plain-form.html`);
    await driver.find('.test-name').sendKeys(randomName);
    await driver.find('.test-year').sendKeys(String(randomYear));
    await driver.find('.test-date').doSendKeys('11').doSendKeys('13').doSendKeys('2022');
    await driver.find('.test-wishes1').click();
    await driver.find('.test-wishes2').click();
    const form = await driver.find('.test-form');
    const successUrl = await form.getAttribute('data-grist-success-url');
    await setAttribute(form, 'data-grist-success-url', successUrl.replace('--NAME--', randomName));
    await driver.find('.test-submit').click();

    // On success, we should get some JSON, which Chrome renders in <pre> tag of a plain page.
    const text = await driver.findWait('pre', 10000).getText();
    const json = JSON.parse(text);
    assert.equal(json.records[0].fields.Name, randomName);
    assert.equal(json.records[0].fields.Year, randomYear);
    assert.equal(json.records[0].fields.Date, 1668297600);    // Grist representation of 11/13/2022
  });
});


async function withReplacedAttr(
  elem: WebElement, attrName: string, newValue: string, callback: () => Promise<void>
) {
  const oldValue = await elem.getAttribute(attrName);
  try {
    await setAttribute(elem, attrName, newValue);
    await callback();
  } finally {
    await setAttribute(elem, attrName, oldValue);
  }
}

async function resetValidity(el: WebElement) {
  await driver.executeScript((el: HTMLInputElement) => el.setCustomValidity(''), el);
}
