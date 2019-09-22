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

const dst_mark_stale = elems => {
	elems.addClass('stale');
	elems.filter(':visible').removeClass('stale').trigger('dst-load').trigger('dst-show');
};

dst_on_load(function() {
	$("body > div.p").addClass('stale');

	$("nav a.p-link").click(function(e) {
		e.preventDefault();
		let anchor = $(this);
		let cur = $("body > div.p:visible");

		let load = function() {
			let target = anchor.data('target');
			anchor.blur();
			$("body > nav a.active").removeClass('active');
			anchor.addClass('active');
			let tdiv = $("body > div.p#" + target);
			tdiv.fadeIn({
				duration: 200,
				start: () => {
					if(tdiv.hasClass('stale')) {
						tdiv.removeClass('stale').trigger('dst-load');
					}
					tdiv.trigger('dst-show');
				},
				complete: () => history.replaceState(null, "", "#" + target),
			});
		};

		if(cur.length === 1) {
			cur.fadeOut(200, load);
		} else {
			cur.hide();
			load();
		}
	});

	dst_get_states([ 'accounts', 'securities', 'settings' ]).then(state => {
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
		dst_on_accounts_change(accounts => {
			let s = $("select#main-account-selector");
			let v = s.val();
			dst_fill_account_select(s, accounts);
			if(s.children("option[value='" + v + "']").length === 1) {
				s.val(v);
			} else {
				s.val("-1");
			}
		});

		/* XXX: not very logical for that to be here, but at that point we're sure all the event handlers from dst_on_load() are there */
		dst_trigger_securities_change(state.securities);
		dst_trigger_accounts_change(state.accounts);

		$("body > div.p").hide();
		$("nav a.p-link[data-target='" + location.hash.substring(1) + "']").click();
	});
});
