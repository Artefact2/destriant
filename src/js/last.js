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

/* This script will be last in the append list. This is awkward, but a
 * way of avoiding race conditions with other event handlers */

dst_on_load(() => dst_get_states([ 'accounts', 'securities', 'settings', 'ext' ]).then(state => {
	$("body > div.p").hide();

	if(state.accounts !== null && state.accounts.length !== 0) {
		if(location.hash.length < 2 || location.hash === "#welcome") {
			location.hash = "#pf";
		}
	} else {
		location.hash = "#welcome";
	}

	let select = $("select#main-account-selector");
	dst_fill_account_select(select, state.accounts);
	if(state.settings !== null && 'main-account' in state.settings
	   && select.children("option[value='" + state.settings['main-account'] + "']").length === 1) {
		select.val(state.settings['main-account']);
	}
	select.change(function() {
		let v = parseInt($(this).val(), 10);
		dst_get_state('settings').then(settings => {
			if(settings === null) settings = {};
			settings['main-account'] = v;
			dst_set_state('settings', settings);
		});
	});
	dst_on_state_change('accounts', accounts => {
		let s = $("select#main-account-selector");
		let v = s.val();
		dst_fill_account_select(s, accounts);
		if(s.children("option[value='" + v + "']").length === 1) {
			s.val(v);
		} else {
			s.val("-1").change();
		}
	});

	return Promise.all([
		dst_trigger_state_change('securities', state.securities),
		dst_trigger_state_change('accounts', state.accounts),
		dst_trigger_state_change('settings', state.settings),
		dst_trigger_state_change('ext', state.ext),
	]).then(() => $("nav a.p-link[data-target='" + location.hash.substring(1) + "']").click());
}));
