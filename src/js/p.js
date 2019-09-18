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

dst_on_load(function() {
	$("nav a.p-link").click(function(e) {
		e.preventDefault();
		let anchor = $(this);
		let cur = $("body > div.p:visible");

		let load = function() {
			let target = anchor.data('target');
			anchor.blur();
			$("body > nav a.active").removeClass('active');
			anchor.addClass('active');
			$("body > div.p#" + target).trigger('dst-load').fadeIn(200, function() {
				history.replaceState(null, "", "#" + target);
			});
		};

		if(cur.length === 1) {
			cur.fadeOut(200, load);
		} else {
			cur.hide();
			load();
		}
	});

	dst_get_state('accounts').then(function(accounts) {
		if(accounts !== null && accounts.length !== 0) {
			if(location.hash.length < 2 || location.hash === "#welcome") {
				location.hash = "#perf";
			}
		} else {
			location.hash = "#welcome";
		}
		$("body > div.p").hide();
		$("body > div.p" + location.hash).trigger('dst-load').show();
		$("body > nav a[data-target='" + location.hash.substring(1) + "']").addClass('active');
	});
});
