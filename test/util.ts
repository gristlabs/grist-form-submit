import * as chai from 'chai';
import express from 'express';
import {driver, WebElement} from 'mocha-webdriver';

import * as fs from 'fs/promises';
import * as http from 'http';
import {AddressInfo} from 'net';
import * as path from 'path';

chai.config.truncateThreshold = 200;

const FIXTURES_ROOT = path.join(__dirname, "fixtures");

// Helper to start a local server to server our script and fixtures.
export async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Listen to an arbitrary port, and wait for it to start listening.
  server.listen(0);
  await new Promise((resolve, reject) => server.once('listening', resolve).once('error', reject));

  const port = (server.address() as AddressInfo).port;
  const url = `http://localhost:${port}`;
  const scriptUrl = `${url}/grist-form-submit.js`;

  // Set up the handlers to serve our script, and to serve fixture, where we replace the public
  // script URL with the URL of our local script version.
  app.get('/grist-form-submit.js', (req, res) => {
    res.sendFile(path.join(__dirname, '../grist-form-submit.js'));
  });
  app.get('/fixtures/:filename', async (req, res) => {
    try {
      const fileContent = await fs.readFile(path.join(FIXTURES_ROOT, req.params.filename), 'utf8');
      const content = fileContent.replace('--SCRIPT--', scriptUrl);
      res.type(path.extname(req.params.filename)).send(content);
    } catch (e) {
      res.status(500).send(String(e));
    }
  });

  const shutdown = () => server.close();
  return {url, shutdown};
}

// Helper to try running a function until it succeeds, for up to timeMs milliseconds.
export async function waitToPass(check: () => Promise<void>, timeMs: number = 4000) {
  try {
    await driver.wait(async () => {
      try {
        await check();
      } catch (e) {
        return false;
      }
      return true;
    }, timeMs);
  } catch (e) {
    await check();
  }
}

// Set an attribute of an element.
export async function setAttribute(el: WebElement, name: string, val: string) {
  await driver.executeScript((e: any, n: any, v: any) => e.setAttribute(n, v), el, name, val);
}
