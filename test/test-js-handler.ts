import {assert, driver, enableDebugCapture} from 'mocha-webdriver';
import {setAttribute, startServer, waitToPass} from './util';

describe('test-js-handler', function() {
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
    await driver.get(`${url}/fixtures/js-handler.html`);
    await driver.find('.test-name').sendKeys('NAME1');

    try {
      await setAttribute(driver.find('.test-name'), 'name', 'Nombre');
      await driver.find('.test-submit').click();
      await waitToPass(async () => {
        assert.match(await driver.find('#error').getText(), /Invalid column "Nombre"/);
      });
      // The output is unchanged.
      assert.equal(await driver.find('#output').getText(), '');
    } finally {
      // Restore the attribute.
      await setAttribute(driver.find('.test-name'), 'name', 'Name');
    }
  });

  it('should submit successfully', async function() {
    const randomName = Array.from(Array(8), () => Math.floor(Math.random() * 36).toString(36)).join('');
    const randomYear = Math.floor(Math.random() * 10000);
    await driver.get(`${url}/fixtures/js-handler.html`);
    await driver.find('.test-name').sendKeys(randomName);
    await driver.find('.test-year').sendKeys(String(randomYear));
    await driver.find('.test-date').doSendKeys('11').doSendKeys('13').doSendKeys('2022');
    await driver.find('.test-wishes1').click();
    await driver.find('.test-wishes2').click();
    await driver.find('.test-submit').click();

    // On success, we should get some JSON, which Chrome renders in <pre> tag of a plain page.
    const text = await driver.findWait('#output:not(:empty)', 10000).getText();
    const json = JSON.parse(text);
    assert.equal(json.records[0].fields.Name, randomName);
    assert.equal(json.records[0].fields.Year, randomYear);
    assert.equal(json.records[0].fields.Date, 1668297600);    // Grist representation of 11/13/2022
  });
});
