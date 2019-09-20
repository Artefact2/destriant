/* Copyright 2019 Romain "Artefact2" Dal Maso <romain.dalmaso@artefact2.com>
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

/**
  * @param state { transactions: … }
  * @param filters { before: 'Y-m-d' or null, accounts: [ id, id… ] or null, tickers: [ ticker, ticker… ] or null }
  * @returns ?
  */
const dst_pf = (state, filters) => {
	let pf = {
		total: { basis: 0.0, realized: 0.0 },
		cash: { basis: 0.0, realized: 0.0 },
		securities: {},
	};

	/* XXX: unrealized gain? */
	/* XXX: multi-currency shenanigans */

	// if(state.securities === null) state.securities = {};
	// if(state.accounts === null) state.accounts = [];
	if(state.transactions === null) state.transactions = [];
	// if(state.prices === null) state.prices = {};

	if(!('before' in filters)) filters.before = null;
	if(!('accounts' in filters)) filters.accounts = null;
	if(!('tickers' in filters)) filters.tickers = null;

	let accounts = {};
	let tickers = {};
	if(filters.accounts !== null) filters.accounts.forEach(id => accounts[id] = true);
	if(filters.tickers !== null) filters.tickers.forEach(tkr => tickers[tkr] = true);

	for(let i in state.transactions) {
		let tx = state.transactions[i];
		if(filters.before !== null && tx.date > filters.before) break;
		if(filters.accounts !== null && !(tx.account in accounts)) continue;
		if(filters.tickers !== null && !(tx.ticker in tickers)) continue;
		dst_pf_apply_tx(state, pf, tx);
	}

	return pf;
};

const dst_pf_apply_tx = (state, pf, tx) => {
	if(tx.type === 'split') {
		if(!(tx.ticker in pf.securities)) return;
		pf.securities[tx.ticker].quantity *= tx.after;
		pf.securities[tx.ticker].quantity /= tx.before;
		return;
	}
	if(tx.type === 'cash') {
		pf.total.realized -= tx.fee;
		pf.cash.realized -= tx.fee;
		pf.total.basis += tx.amount - tx.fee;
		pf.cash.basis += tx.amount - tx.fee;
		return;
	}

	console.assert(tx.type === 'security');
	if(!(tx.ticker in pf.securities)) {
		pf.securities[tx.ticker] = { quantity: 0.0, basis: 0.0, realized: 0.0 };
	}

	let s = pf.securities[tx.ticker];
	s.realized -= tx.fee;
	pf.total.realized -= tx.fee;

	if(Math.abs(s.quantity) < 1e-9 || s.quantity * tx.quantity >= 0) {
		/* Opening long/short position */
		s.quantity += tx.quantity;
		pf.total.basis += tx.quantity * tx.price;
		s.basis += tx.quantity * tx.price;
		return;
	}

	/* Closing long/short position */
	let q;
	if((s.quantity + tx.quantity) * s.quantity >= 0) {
		/* Complete or partial close */
		q = tx.quantity;
	} else {
		/* Complete close + opening an opposite position */
		/* eg: buy 10, sell 20 */
		q = -s.quantity;
	}

	/* Close position */
	pf.total.realized += -q * (tx.price - s.basis / s.quantity);
	s.realized += -q * (tx.price - s.basis / s.quantity);
	pf.total.basis += q * (s.basis / s.quantity);
	s.basis += q * (s.basis / s.quantity);

	s.quantity += tx.quantity;
	tx.quantity -= q;

	/* Maybe reopen position */
	s.quantity += tx.quantity;
	pf.total.basis += tx.quantity * tx.price;
	s.basis += tx.quantity * tx.price;
};
