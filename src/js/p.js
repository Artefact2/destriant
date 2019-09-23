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
					} else {
						tdiv.trigger('dst-show');
					}
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
});
