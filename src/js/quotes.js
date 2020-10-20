/* Copyright 2019, 2020 Romain "Artefact2" Dal Maso <romain.dalmaso@artefact2.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

const dst_fetch_quotes = security => {
	switch(security.exchange) {
	case 'XPAR':
	case 'XAMS':
		return dst_fetch_euronext_quotes(security);

	case 'XETR':
		return dst_fetch_xetra_quotes(security);

	default:
		return new Promise((resolve, reject) => resolve({}));
	}
};

const dst_fetch_euronext_quotes = security => Promise.all([
	fetch('https://live.euronext.com/fr/ajax/AwlHistoricalPrice/getFullDownloadAjax/' + security.isin + '-' + security.exchange, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: 'format=csv&decimal_separator=.&date_form=d/m/Y&op=&adjusted=&base100=',
	}).then(r => r.text()),
	fetch('https://live.euronext.com/fr/ajax/getIntradayPriceFilteredData/' + security.isin + '-' + security.exchange, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: 'startTime=&endTime=',
	}).then(r => r.json()),
]).then(data => {
	let csv = data[0];
	let lines = csv.split("\n");
	if(lines.length < 4 || lines[2] !== security.isin) throw csv;

	let columns = lines[3].split(';');
	if(columns.length < 5 || columns[0] !== "Date" || columns[4] !== "Close") throw [ columns, csv ];
	lines.splice(0, 4);
	lines.pop();
	let quotes = {};
	lines.forEach(line => {
		line = line.split(';');
		if(line.length < 5) throw [ line, csv ];
		let date = line[0].split('/');
		date = date[2] + '-' + date[1] + '-' + date[0]; /* d/m/Y -> Y-m-d */
		quotes[date] = parseFloat(line[4]);
	});
	let date = data[1].date.split('/');
	date = date[2] + '-' + date[1] + '-' + date[0];
	if(!(date in quotes) && "rows" in data[1] && data[1].rows.length > 0) {
		quotes[date] = parseFloat(data[1].rows[0].price.replace(',', '.'));
	}
	return quotes;
}).catch(e => console.error(security, e));

const dst_fetch_xetra_quotes = security => {
	const d = new Date();
	const end = Math.floor(d.getTime() / 1000);
	d.setFullYear(d.getFullYear() - 1);
	const start = Math.floor(d.getTime() / 1000);

	return Promise.all([
		new Promise((resolve, reject) => {
			const es = new EventSource('https://api.boerse-frankfurt.de/v1/data/price_information?isin=' + security.isin + '&mic=XETR');
			/* XXX: use Promise.finally? but es is out of scope */
			es.onmessage = event => { es.close(); resolve(event); };
			es.onerror = err => { es.close(); reject(err); };
		}).then(m => JSON.parse(m.data)),
		new Promise((resolve, reject) => {
			const es = new EventSource('https://api.boerse-frankfurt.de/v1/tradingview/lightweight/history?resolution=D&isKeepResolutionForLatestWeeksIfPossible=false&from=' + start + '&to=' + end + '&isBidAskPrice=false&symbols=XETR%3A' + security.isin);
			es.onmessage = event => { es.close(); resolve(event); };
			es.onerror = err => { es.close(); reject(err); };
		}).then(m => JSON.parse(m.data)),
	]).then(data => {
		let quotes = {};
		for(let q of data[1].quotes.timeValuePairs) {
			quotes[(new Date(q.time * 1000)).toISOString().split('T')[0]] = q.value;
		}
		quotes[data[0].timestampLastPrice.split('T')[0]] = data[0].lastPrice;
		return quotes;
	});
};
