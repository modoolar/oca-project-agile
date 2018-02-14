// Copyright 2017 - 2018 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

odoo.define('project_agile_scrum.web.burndown_chart', function (require) {
    "use strict";

    var ControlPanelMixin = require('web.ControlPanelMixin');
    var Widget = require('web.Widget');
    var session = require('web.session');
    var core = require('web.core');
    var data = require('web.data');
    var Model = require('web.Model');
    var ActionManager = require('web.ActionManager');

    var _t = core._t;
    var QWeb = core.qweb;
    var bus = core.bus;

    var FormView = require('web.FormView');

    var FieldMany2One = core.form_widget_registry.get('many2one');
    var FieldDatetime = core.form_widget_registry.get('datetime');
    var FieldInteger = core.form_widget_registry.get('integer');


    var BurndownChart = Widget.extend(ControlPanelMixin, {
        className: 'pa_web_burndown_chart',
        template: 'ProjectAgileScrum.BurndownChart',
        title: _t("Burndown Chart"),

        init: function (parent, context) {
            this._super(parent);
            this.action_manager = this.findAncestor(function(ancestor){ return ancestor instanceof ActionManager });
            this.agile_team_id = context.context.team_id || false;

            this.details_field_manager = false;

            this.create_form_fields = {
                team_id: {
                    id: "team_id",
                    index: 0, // position in the form
                    label: _t("Scrum Team"),
                    required: false,
                    constructor: FieldMany2One,
                    field_properties: {
                        relation: "project.agile.team",
                        string: _t("Scrum Team"),
                        type: "many2one",
                    },
                },
                start_date: {
                    id: "start_date",
                    index: 5,
                    label: _t("Start Date"),
                    required: false,
                    constructor: FieldDatetime,
                    field_properties: {
                        string: _t("Start Date"),
                        type: "datetime",
                    },
                },
                end_date: {
                    id: "actual_end_date",
                    index: 15,
                    label: _t("End Date"),
                    required: false,
                    constructor: FieldDatetime,
                    field_properties: {
                        string: _t("End Date"),
                        type: "datetime",
                    },
                },
                total_story_points: {
                    id: "total_story_points",
                    index: 10,
                    label: _t("Story Points"),
                    required: false,
                    constructor: FieldInteger,
                    field_properties: {
                        string: _t("Story Points"),
                        type: "integer",
                    },
                },
                velocity: {
                    id: "velocity",
                    index: 20,
                    label: _t("Velocity"),
                    required: false,
                    constructor: FieldInteger,
                    field_properties: {
                        string: _t("Velocity"),
                        type: "integer",
                    },
                },
            };
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
                attrs: { string: "Project Task", version: "7.0", class: "oe_form_container o_form_container" },
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

            this.sprint_field = this.prepare_sprint_field();
            this.sprint_field.widget.appendTo(this.$(".change_sprint_container"));
            this.sprint_field.widget.on("change:value", this.sprint_field.node, field => {
                this.changeSprint(field.get_value());
            });
            this.sprint_field.widget.$el.find("input").attr("placeholder", _t("Select Sprint"));
            this.field_manager.do_show();
        },

        prepare_sprint_field(){
            var domain = [['state','!=', 'draft']];

            if (this.agile_team_id){
                domain.push(['team_id', '=', this.agile_team_id]);
            }

            var field = this.prepare_sprint_field_metadata(domain);
            this.field_manager.fields_view.fields[field.node.attrs.name] = field.data;
            field.widget = new FieldMany2One(this.field_manager, field.node);
            return field;
        },

        prepare_sprint_field_metadata(domain, context) {
            return {
                data: {
                    relation: "project.agile.scrum.sprint",
                    string: _t("Sprint"),
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
                        name: "change_sprint",
                        nolabel: "True",
                        options: "{'no_create': True}",
                    }
                }
            };
        },

        changeSprint(sprint_id){
            this.load_burndown_chart(sprint_id);
            this.load_sprint_details(sprint_id);
        },

        load_sprint_details: function(sprint_id) {
            if (!this.details_field_manager) {

                var create_form_fields = this.create_form_fields;
                var create_form_fields_arr = [];
                for (var key in create_form_fields)
                    if (create_form_fields.hasOwnProperty(key))
                        create_form_fields_arr.push(create_form_fields[key]);
                create_form_fields_arr.sort(function (a, b) {
                    return a.index - b.index
                });

                let dataset = new data.DataSet(this, "project.agile.scrum.sprint", this.context);
                dataset.ids = [sprint_id];
                dataset.index = 0;

                var fields_view = {};
                fields_view.arch = {
                    attrs: {string: "Sprint", version: "7.0", class: "oe_form_container o_form_container"},
                    children: [],
                    tag: "form"
                };

                this.details_field_manager = new FormView(this, dataset, fields_view, {
                    initial_mode: 'edit',
                    disable_autofocus: false,
                    $buttons: $(),
                    $pager: $()
                });

                // fields default properties
                var Default_field = function () {
                    this.context = {};
                    this.domain = [];
                    this.help = "";
                    this.required = false;
                    this.readonly = true;

                    this.selectable = true;
                    this.states = {};
                    this.views = {};
                };
                var Default_node = function (field_name) {
                    this.tag = "field";
                    this.children = [];
                    this.required = false;
                    this.attrs = {
                        invisible: "False",
                        modifiers: '{"required":false, "readonly": true}',
                        name: field_name,
                        nolabel: "True",
                    };
                };

                this.details_field_manager.fields_view.fields = {};
                for (var i = 0; i < create_form_fields_arr.length; i++) {
                    this.details_field_manager.fields_view.fields[create_form_fields_arr[i].id] = _.extend(
                        new Default_field(),
                        create_form_fields_arr[i].field_properties
                    );
                }

                this.create_form = [];
                for (var i = 0; i < create_form_fields_arr.length; i++) {
                    var field_data = create_form_fields_arr[i];

                    // create widgets
                    var node = new Default_node(field_data.id);
                    if (!field_data.required) node.attrs.modifiers = "";
                    var field = new field_data.constructor(this.details_field_manager, node);
                    field.set("effective_readonly", true);
                    this[field_data.id + "_field"] = field;
                    this.create_form.push(field);

                    // append to DOM
                    var $field_container = $(QWeb.render("ProjectAgileScrum.form_create_field", {
                        id: field_data.id,
                        label: field_data.label
                    }));
                    field.appendTo($field_container.find(".o_td_field"));
                    this.$(".create_group_" + (i % 2 === 0 ? "left" : "right")).append($field_container);

                    this.details_field_manager.register_field(field, field_data.id);
                }
                this.details_field_manager.appendTo(document.createDocumentFragment()); // starts the FormView
                this.details_field_manager.do_show();
            } else {
                this.details_field_manager.dataset.ids = [sprint_id];
                this.details_field_manager.dataset.index = 0;
                this.details_field_manager.do_show({reload: true});
            }
        },

        load_burndown_chart(sprint_id){
            return new Model("project.agile.scrum.sprint")
                    .call("prepare_burndown_chart_data", [[sprint_id]])
                    .then(data => {
                        var config = this.prepare_config(
                            data.labels,
                            [this.prepare_actual(data.actual), this.prepare_ideal(data.ideal)]
                        )

                        var canvas = this.$el.find('canvas')[0];
                        var ctx = canvas.getContext('2d');
                        this.chart = new Chart(ctx, config);
                    });
        },

        prepare_actual(actual){
            return {
                label: _('Actual'),
                steppedLine: 'after',
                data: actual,
                borderColor: 'rgb(153, 102, 255)',
                fill: false,
            }
        },

        prepare_ideal(ideal) {
            return {
                label: _('Ideal'),
                steppedLine: false,
                data: ideal,
                borderColor: 'rgb(255, 99, 132)',
                fill: false,
                borderDash: [5, 5],
            }
        },

        prepare_config(labels, datasets, options){
            return {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: datasets,
                },
                options: _.extend({
                    responsive: true,
                    title: {
                        display: true,
                        text: _t('Burndown Chart'),
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

    core.action_registry.add('burndown_chart', BurndownChart);
    return BurndownChart;

});