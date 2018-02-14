// Copyright 2017 - 2018 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

odoo.define('project_agile_scrum.web.iteration.burndown_chart', function (require) {
    "use strict";

    var ControlPanelMixin = require('web.ControlPanelMixin');
    var Widget = require('web.Widget');
    var core = require('web.core');
    var data = require('web.data');
    var Model = require('web.Model');
    var ActionManager = require('web.ActionManager');

    var _t = core._t;

    var FormView = require('web.FormView');

    var FieldMany2One = core.form_widget_registry.get('many2one');


    var IterationBurndownChart = Widget.extend(ControlPanelMixin, {
        className: 'pa_web_iteration_burndown_chart',
        template: 'ProjectAgileScrum.IterationBurndownChart',
        title: _t("Iteration Burndown Chart"),

        init: function (parent, context) {
            this._super(parent);
            this.action_manager = this.findAncestor(function(ancestor){ return ancestor instanceof ActionManager });
            this.agile_team_id = context.context.team_id || false;
            this.details_field_manager = false;
        },

        start(){
            return $.when(this._super()).then(() => {
                this.update_cp();
            });
        },

        renderElement(){
            return $.when(this._super()).then(() => {
                this.createFormWidgets();
            });
        },

        createFormWidgets: function() {
            let dataset = new data.DataSet(this, "project.agile.scrum.sprint", this.context);
            dataset.ids = [];

            var fields_view = {};
            fields_view.arch = {
                attrs: { string: "Sprint", version: "7.0", class: "oe_form_container o_form_container" },
                children: [],
                tag: "form"
            };
            this.field_manager = new FormView (this, dataset, fields_view, {
                initial_mode: 'edit',
                disable_autofocus: false,
                $buttons: $(),
                $pager: $()
            });

            this.field_manager.appendTo(document.createDocumentFragment()); // starts the FormView
            this.field_manager.fields_view.fields = {};

            this.team_field = this.prepare_team_field();
            this.team_field.widget.appendTo(this.$(".change_sprint_container"));
            this.team_field.widget.on("change:value", this.team_field.node, field => {
                this.changeTeam(field.get_value());
            });
            this.team_field.widget.$el.find("input").attr("placeholder", _t("Select Team"));
            this.field_manager.do_show();
        },

        prepare_team_field(){
            var domain = [['type','=', 'scrum']];
            var field = this.prepare_team_field_metadata(domain);
            this.field_manager.fields_view.fields[field.node.attrs.name] = field.data;
            field.widget = new FieldMany2One(this.field_manager, field.node);
            return field;
        },

        prepare_team_field_metadata(domain, context) {
            return {
                data: {
                    relation: "project.agile.team",
                    string: _t("Team"),
                    type: "many2one",
                    domain: domain,
                    help: "",
                    readonly: false,
                    required: true,
                    selectable: true,
                    states: {},
                    views: {},
                    context: {},
                },

                node: {
                    tag: "field",
                    children: [],
                    required: true,
                    context: context || "{}",
                    attrs: {
                        invisible: "False",
                        modifiers: '',
                        name: "change_team",
                        nolabel: "True",
                        options: "{'no_create': True}",
                    }
                }
            };
        },

        changeTeam(team_id){
            this.load_burndown_chart(team_id);
        },

        load_burndown_chart(team_id){
            let domain = [['team_id', '=', team_id], ['state', '!=', 'draft']];
            let fields = ['name', 'velocity', 'total_story_points'];

            return new Model("project.agile.scrum.sprint")
                .call("search_read", [domain, fields])
                .then(sprints => {

                    let datasets = [];
                    let labels = [];
                    let color = Chart.helpers.color;

                    for (let sprint in sprints){
                        labels.push(sprint.name);

                        datasets.push({
                            'label': sprint.name,
                            'backgroundColor': color('rgb(54, 162, 235)').alpha(0.5).rgbString(),
                            'borderColor': 'rgb(54, 162, 235)',
                            'borderWidth': 1,
                            'data': [sprint.velocity],
                        })
                    }

                    let config = this.prepare_config(labels, datasets);
                    let canvas = this.$el.find('canvas')[0];
                    let ctx = canvas.getContext('2d');
                    this.chart = new Chart(ctx, config);

                });
        },

        prepare_config(labels, datasets, options){
            return {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: datasets,
                },
                options: _.extend({
                    responsive: true,
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: _t('Iteration Burndown Chart'),
                    }
                }, options || {})
            }
        },

        update_cp: function() {
            var self = this;
            self.update_control_panel({
                breadcrumbs: self.action_manager.get_breadcrumbs(),
            });
        },

    });

    core.action_registry.add('iteration_burndown_chart', IterationBurndownChart);
    return IterationBurndownChart;

});