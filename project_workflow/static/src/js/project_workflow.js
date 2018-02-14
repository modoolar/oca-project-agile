// Copyright 2017 - 2018 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

odoo.define('project_workflow.TaskWorkflow', function (require) {
    "use strict";

    var config = require('web.config');
    var core = require('web.core');
    var Model = require('web.Model');
    var common = require('web.form_common');
    var data = require('web.data');
    var utils = require('web.utils');

    var DEFAULT_VISIBLE_TRANSITIONS = 3;

    var QWeb = core.qweb;

    var TaskWorkflow = common.AbstractField.extend({
        className: "o_statusbar_status oe_right",
        init: function(field_manager, node) {
            this._super(field_manager, node);
            this.options.clickable = true;
            this.options.visible = this.options.visible || (this.node.attrs || {}).statusbar_visible || false;
            this.set({value: false});
            this.selection = [];
            this.set("selection", []);
            this.selection_dm = new utils.DropMisordered();
            this.confirmation_action = {
                module:"project_workflow",
                xml_id:"wkf_project_task_confirmation_action",
            };

            this.transitions_available = [];
            this.transitions_visible = [];
            this.transitions_hidden = [];

            this.max_visible_transitions = this.options.no_visible_transitions || DEFAULT_VISIBLE_TRANSITIONS;

            // We need to restart widget when form content changes
            var self = this;
            this.getParent().on("load_record", this, function(){
                var parent = self.getParent();
                if (parent.record_loaded){
                    parent.record_loaded.done(function(){
                        self.start();
                    });
                }

            });
        },
        start: function() {
            this.on("change:value", this, this.get_selection);
            this.on("change:evaluated_selection_domain", this, this.get_selection);
            this.on("change:selection", this, function() {
                this.selection = this.get("selection");
                this.render_value();
            });
            this.get_selection_render(true);

            this.$el.on('click','button[data-id]',this.on_click_stage);

            this._super();
        },
        set_value: function(value_) {
            if (value_ instanceof Array) {
                value_ = value_[0];
            }
            this._super(value_);
        },
        render_value: function() {
            var self = this;

            this.$el.off('click','button[data-id]',this.on_click_stage);

            var $content = $(QWeb.render("TaskWorkflowNavigation.content", {
                'widget': self,
            }));
            self.$el.empty().append($content.get().reverse());

            this.$el.on('click','button[data-id]',this.on_click_stage);
        },

        get_selection: function() {
            this.get_selection_render(false)
        },

        get_selection_render: function(render){
            var self = this;
            var selection = [];

            var calculation = _.bind(function() {
                var workflow_id = self.field_manager.fields[self.name].get_value();
                var stage_id = self.field_manager.fields.stage_id.get_value();
                return new Model('project.workflow').call('get_state_transitions', [workflow_id, stage_id, self.view.datarecord.id]).then(function (transitions) {
                   //_.each(tranitions, function(transitions){
                        // selection.push(transition)

                    self.transitions_available = {};

                    _.each(transitions, function (transition) {
                        self.transitions_available[transition.id] = transition;
                    });

                    let count = 0

                    transitions = transitions.sort((a, b) => a.sequence > b.sequence);

                    self.transitions_visible = [];
                    while(count < transitions.length && count < self.max_visible_transitions){
                        self.transitions_visible.push(transitions[count++]);
                    }

                    self.transitions_hidden = [];
                    while (count < transitions.length){
                        self.transitions_hidden.push(transitions[count++]);
                    }
                    //});
                });
            }, this);
            this.selection_dm.add(calculation()).then(function () {
                //self.set("selection", selection);
                if (render)
                    self.render_value();
            });
        },

        on_click_stage: function (ev) {

            console.log("on_click_stage: ", ev);

            var self = this;
            var $li = $(ev.currentTarget);
            var val = parseInt($li.data("id"), 10);

            // var state = false;
            // _.each(self.selection, function(s){
            //     if(s.id === val)
            //         state = s;
            // });

            var state = this.transitions_available[val];

            self.view.recursive_save().done(function() {
                if (state.confirmation){
                    self.do_confirmation(state);
                } else {
                    self.update_and_render(state);
                }
            });
        },

        update_and_render: function(state){
            var self = this;
            var values = self.prepare_values_for_update(state);
            self.view.dataset.write(self.view.datarecord.id, values).done(function() {
                self.view.reload().then(function(){
                    self.get_selection_render(true);
                })
            });
        },

        prepare_values_for_update: function (state) {
            return { stage_id:state.id }
        },

        build_confirmation_context: function(state){
            var context = this.build_context().eval();
            context['default_task_id'] = this.view.datarecord.id;
            context['default_stage_id'] = state.id;
            return context;
        },

        build_confirmation_options: function (state) {
            var self = this;
            var options = {};
            options.additional_context = self.build_confirmation_context(state);
            options.on_close = function(){
                // After action has been executed I have to check to see if the action has been canceled.
                // The only way that I know to do this is to read stage value from the server.
                // If the ID value of the clicked transition stage is the same as the value on the server
                // then the user has applied transition
                return new Model('project.task')
                    .call("read", [self.view.datarecord.id, ['stage_id']])
                    .then(function(record){
                        if (record[0].stage_id[0] == state.id)
                            self.update_and_render(state);
                    });
            };
            return options;
        },

        do_confirmation: function(state){
            var self = this;
            new Model('ir.actions.act_window')
                .call("for_xml_id", [self.confirmation_action.module, self.confirmation_action.xml_id])
                .then(function(action){
                    var options = self.build_confirmation_options(state);
                    return self.do_action(action, options);
                });
        },

    });
    core.form_widget_registry.add('task_workflow', TaskWorkflow);

    return TaskWorkflow;
});