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

const dst_get_state = function(key) {
	/* XXX: better error handling */
	return localforage.getItem(key).catch(err => console.error(key, err));
};

const dst_set_state = function(key, val) {
	return localforage.setItem(key, val).catch(err => console.error(key, err));
};

const dst_get_states = function(keys) {
	return Promise.all(keys.map(k => dst_get_state(k).then(v => [ k, v ]))).then(values => {
		let s = {};
		values.forEach(v => s[v[0]] = v[1]);
		return s;
	});
};

const dst_set_states = function(obj) {
	return Promise.all(Object.keys(obj).map(k => dst_set_state(k, obj[k])));
};

const dst_load_pf = pf => {
	console.assert(pf['destriant-version'] === 1);
	console.assert(!('accounts' in pf) || Array.isArray(pf.accounts));
	console.assert(!('transactions' in pf) || Array.isArray(pf.transactions));
	console.assert(!('securities' in pf) || (pf.securities !== null && typeof pf.securities === 'object'));
	console.assert(!('prices' in pf) || (pf.prices !== null && typeof pf.prices === 'object'));
	console.assert(!('settings' in pf) || (pf.settings !== null && typeof pf.prices === 'object'));
	/* XXX: do more thourough validation here, malicious imported data can be harmful */
	return dst_set_states(pf);
}

dst_on_load(function() {
	if(!localforage.supports(localforage.INDEXEDDB)) {
		console.error('Indexed DB not supported, maximum portfolio size will be impacted');
	}

	$("a#nav-save-pf").click(function() {
		let modal = $("div#export-pf-modal");
		let a = modal.find('a');
		if(a.length === 1) {
			URL.revokeObjectURL(a.prop('href'));
		}
		modal.find('p').empty().text('Exporting portfolio…');
		modal.modal('show');

		dst_get_states([
			'accounts',
			'securities',
			'transactions',
			'prices',
			'settings',
		]).then(pf => {
			pf['destriant-version'] = 1;
			let b = new Blob([ JSON.stringify(pf) ], { type: 'application/json' });
			let uri = URL.createObjectURL(b);
			let fn = 'destriant_' + new Date().toISOString() + '.json';

			modal.find('p').empty().append($(document.createElement('a')).append(
				'Download portfolio: ' + fn
			).prop('href', uri).prop('download', fn));
		});
	});
	$("button#export-pf-modal-close").click(function() {
		$("div#export-pf-modal").modal('hide');
	});

	$("a#nav-load-pf, button#welcome-import-pf").click(function() {
		$("div#import-pf-modal form")[0].reset();
		$("button#import-pf-modal-import").prop('disabled', false);
		$("div#import-pf-modal").modal('show');
	});
	$("button#import-pf-modal-close").click(function() {
		$("div#import-pf-modal").modal('hide');
	});
	$("div#import-pf-modal form").submit(function(e) {
		e.preventDefault();

		let input = $("div#import-pf-modal input#import-pf-file")[0];
		if(input.files.length !== 1) return;
		$("button#import-pf-modal-import").prop('disabled', true);

		$("div#import-pf-modal button#import-pf-modal-import").prop('disabled', true);
		let r = new FileReader();
		r.onload = function() {
			let pf = JSON.parse(r.result);
			dst_load_pf(pf).then(() => {
				$("div#import-pf-modal").modal('hide');
				dst_mark_stale($("div.p"));
				$("a.nav-link[data-target='pf']").click();
			});
		};
		r.readAsText(input.files[0]);
	});
	$("button#welcome-import-demo-pf").click(function() {
		let btn = $(this).prop('disabled', true);
		dst_get_state('accounts').then(accounts => {
			if(accounts !== null && accounts.length > 0) {
				/* XXX: crude, but works */
				if(prompt("It looks like you already have some accounts set up. \nDo you really want to erase your data? Type uppercase “erase” to proceed.") !== "ERASE") {
					btn.prop('disabled', false);
					return;
				}
			}

			dst_set_btn_spinner(btn, 6); /* XXX: 1+(hardcoded number of securities in demo pf) */
			fetch('demo.json')
				.then(r => r.json())
				.then(pf => dst_load_pf(pf))
				.then(() => dst_get_state('securities'))
				.then(securities => Promise.all(Object.values(securities).map(s => dst_fetch_quotes(s).then(() => dst_set_btn_spinner_progress(btn, 1)))))
				.then(() => {
					dst_unset_btn_spinner(btn);
					dst_mark_stale($("div.p"));
					$("a.nav-link[data-target='pf']").click();
			});
		});
	});
});
