// Copyright 2017 - 2018 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

odoo.define('project_agile.WebAgileReportsView', function (require) {
    "use strict";

    var core = require('web.core');
    var Model = require('web.Model');

    var KanbanView = require('web_kanban.KanbanView');

        var QWeb = core.qweb;
        var _t = core._t;
        var _lt = core._lt;

    var ReportsView = KanbanView.extend({
        display_name: _lt('Reports'),
        icon: 'fa-line-chart',
        searchview_hidden: true,
        events: {
            'click .pa_report_action': 'on_report_action_clicked',
        },

        on_report_action_clicked: function(ev){
            ev.preventDefault();

            var $action = $(ev.currentTarget);
            var action_id = parseInt($action.attr('action'));

            new Model('ir.actions.client')
                .call("read", [[action_id]])
                .then(actions => {
                    var action = actions[0];
                    var context = this.dataset.get_context().eval();
                    var additional_context = {
                        team_id: context.agile_team_id,
                    };

                    this.do_action(action, {additional_context: additional_context});
                });


        },
    });

    core.view_registry.add('pa_web_reports', ReportsView);

    return ReportsView;
});