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

const dst_sorted_securities = (tickers, exposureOf, pnlOf, securities, settings) => {
	if(typeof settings !== 'object' || !('security-sort' in settings)) return tickers;

	let cmp;
	switch(settings['security-sort']) {
	case 'exp':
		cmp = (t1, t2) => exposureOf(t2) - exposureOf(t1);
		break;

	case 'pnl':
		cmp = (t1, t2) => pnlOf(t2) - pnlOf(t1);
		break;

	case 'ticker':
		cmp = (t1, t2) => t1 < t2 ? -1 : 1;
		break;

	case 'name':
		cmp = (t1, t2) => securities[t1].name < securities[t2].name ? -1 : 1;
		break;

	default:
		return tickers;
	}

	return tickers.sort(cmp);
};

const dst_sorted_pf_securities = (pf, securities, settings) => dst_sorted_securities(
	Object.keys(pf.total.securities),
	tkr => pf.total.securities[tkr].basis + pf.total.securities[tkr].unrealized,
	tkr => pf.total.securities[tkr].realized + pf.total.securities[tkr].unrealized,
	securities, settings
);

dst_on_load(() => {
	$("div#settings").on('dst-load', () => dst_get_state('settings').then(settings => {
		if(settings === null) settings = {};

		$("input#settings-auto-quotes").prop('checked', 'auto-quotes' in settings && settings['auto-quotes']).change();
		$("input#settings-auto-quotes-frequency").val('auto-quotes-frequency' in settings ? settings['auto-quotes-frequency'] : 30);
		$("input#settings-auto-quotes-after").val('auto-quotes-after' in settings ? settings['auto-quotes-after'] : '09:15');
		$("input#settings-auto-quotes-before").val('auto-quotes-before' in settings ? settings['auto-quotes-before'] : '18:00');

		$("select#settings-security-sort").val('security-sort' in settings ? settings['security-sort'] : 'default');
	}));

	$("input#settings-auto-quotes").change(function() {
		$("div#settings input.only-auto-quotes").prop('disabled', !this.checked);
	});

	$("div#settings > form").submit(function(e) {
		e.preventDefault();
		let btn = $("button#settings-save").prop('disabled', true), span;

		dst_get_state('settings').then(settings => {
			if(settings === null) settings = {};
			settings['auto-quotes'] = $("input#settings-auto-quotes").is(':checked');
			if(settings['auto-quotes']) {
				settings['auto-quotes-frequency'] = $('input#settings-auto-quotes-frequency').val();
				settings['auto-quotes-after'] = $('input#settings-auto-quotes-after').val();
				settings['auto-quotes-before'] = $('input#settings-auto-quotes-before').val();
			}

			settings['security-sort'] = $("select#settings-security-sort").val();
			dst_trigger_state_change('settings', settings);
			return settings;
		}).then(settings => dst_set_state('settings', settings)).then(() => {
			btn.prop('disabled', false).after(span = $(document.createElement('span')).addClass('text-success pl-2').text('Saved!'));
			setTimeout(() => span.fadeOut(1000, () => span.remove()), 10000);
		});
	});
});
