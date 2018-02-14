// Copyright 2017 - 2018 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

odoo.define('project_workflow.DiagramView', function (require) {
    "use strict";

    var core = require('web.core');
    var Model = require('web.Model');
    var form_common = require('web.form_common');
    var DiagramView = require('web_diagram_position.DiagramView');
    var Dialog = require('web.Dialog');
    var QWeb = core.qweb;

    var _t = core._t;

    DiagramView.include({

        render_buttons: function($node) {
            if (this.model === 'project.workflow') {
                var self = this;

                this.$buttons = $(QWeb.render("ProjectWorkflow.buttons", {'widget': this}));
                this.$buttons.on('click', '.o_diagram_edit', function() {
                    self.edit_workflow();
                });

                this.$buttons.on('click', '.o_diagram_new_button', function() {
                    self.add_node();
                });

                this.$buttons.on('click', '.o_diagram_publish', function() {
                    self.button_workflow_publish();
                });

                this.$buttons.on('click', '.o_diagram_discard', function() {
                    self.button_workflow_discard();
                });

                this.$buttons.on('click', '.o_diagram_export', function() {
                    self.button_workflow_export();
                });

                $node = $node || this.options.$buttons;
                this.$buttons.appendTo($node);

            } else {
                this._super($node);
            }
        },

        edit_workflow(){
            var self = this;
            new Model('ir.model.data').call("xmlid_to_res_id", ["project_workflow.edit_project_workflow"]).then(function(view_id){
                var title = _t('Workflow');
                var pop = new form_common.FormViewDialog(self, {
                    res_model: self.model,
                    res_id: self.id,
                    view_id: view_id,
                    context: self.context || self.dataset.context,
                    title: _t("Edit:") + title,
                    disable_multiple_selection: true,
                }).open();
            });



            // var form_controller = pop.view_form;
            // var form_fields = [this.parent_field];
            //
            // form_controller.on("load_record", self, function(){
            //     _.each(form_fields, function(fld) {
            //         if (!(fld in form_controller.fields)) { return; }
            //         var field = form_controller.fields[fld];
            //         field.set_value(self.id);
            //         field.dirty = true;
            //     });
            // });
        },

        button_workflow_publish: function(){
            var self = this;
            var publish_workflow = function(){

                return self.dataset.read_ids([self.id], ['original_name']).then(function(obj){
                    var wkf_name = obj[0].original_name;
                    console.log(obj);

                    return new Model("project.workflow").call("publish_workflow", [self.id], {context: {diagram:true}}).then(function(result){
                        console.log("Publish Action: ", result);
                        if (result)
                            self.do_action(result);
                        else
                            return self.ViewManager.action_manager.history_back().then(function(){
                                Dialog.alert(self, _t("Workflow '" + wkf_name + "' has been successfully published!"));
                            });
                    });
                });
            };

            Dialog.confirm(self, _t("Are you sure you want to publish this workflow?"), { confirm_callback: publish_workflow })
        },

        button_workflow_discard: function(){
            var self = this;

            var discard_workflow = function(){
                self.dataset.call("discard_working_copy", [self.id]).then(function(result){
                if (result)
                    self.do_action(result);
                });
            }

            Dialog.confirm(self, _t("Are you sure you want to discard this workflow?"), { confirm_callback: discard_workflow })
        },

        button_workflow_export: function () {
            var self = this;

            self.dataset.call("export_workflow", [self.id]).then(function(result) {
                self.do_action(result);
            });
        },

        get_style: function(){
            var style = this._super();

            if (this.model == 'project.workflow') {
                style.yellow = "#f6c342";
                style.green = "#14892c";
                style.blue = "#4a6785";

                // Original node size:
                //style.node_size_x = 110; // width
                //style.node_size_y = 80;  // height

                style.node_size_x = 100;
                style.node_size_y = 30;
            }

            return style;
        },
    });

    return DiagramView;
});
