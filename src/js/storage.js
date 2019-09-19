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
		]).then(pf => {
			pf['destriant-version'] = 1;
			let b = new Blob([ JSON.stringify(pf) ], { type: 'application/json' });
			let uri = URL.createObjectURL(b);
			let fn = 'destriant_' + Date.now().toString() + '.json';

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
		$("div#import-pf-modal").modal('show');
	});
	$("button#import-pf-modal-close").click(function() {
		$("div#import-pf-modal").modal('hide');
	});
	$("div#import-pf-modal form").submit(function() {
		let input = $("div#import-pf-modal input#import-pf-file")[0];
		if(input.files.length !== 1) return;

		$("div#import-pf-modal button#import-pf-modal-import").prop('disabled', true);
		let r = new FileReader();
		r.onload = function() {
			let pf = JSON.parse(r.result);
			console.assert(pf['destriant-version'] === 1);
			console.assert(!('accounts' in pf) || Array.isArray(pf.accounts));
			console.assert(!('transactions' in pf) || Array.isArray(pf.transactions));
			console.assert(!('securities' in pf) || (pf.securities !== null && typeof pf.securities === 'object'));
			console.assert(!('prices' in pf) || (pf.prices !== null && typeof pf.prices === 'object'));
			/* XXX: do more thourough validation here, malicious imported data can be harmful */

			dst_set_states(pf).then(function() {
				location.reload();
			});
		};
		r.readAsText(input.files[0]);
	});
});
