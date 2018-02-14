// Copyright 2017 - 2018 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

odoo.define('web_diagram_position.DiagramView', function (require) {
    "use strict";

    var core = require('web.core');
    var common = require('web.form_common');
    var data_manager = require('web.data_manager');
    var data = require('web.data');
    var FormView = require('web.FormView');
    var DiagramView = require('web_diagram.DiagramView');

    var _t = core._t;

    var FormViewDialog = common.ViewDialog.extend({
        init: function (parent, options) {
            var self = this;

            var multi_select = false;
            var readonly = _.isNumber(options.res_id) && options.readonly;

            if (!options || !options.buttons) {
                options = options || {};
                options.buttons = [
                    {
                        text: (readonly ? _t("Close") : _t("Discard")), classes: "btn-default o_form_button_cancel", close: true, click: function () {
                        self.view_form.trigger('on_button_cancel');
                    }
                    }
                ];

                if (!readonly) {
                    options.buttons.splice(0, 0, {
                        text: _t("Save") + ((multi_select) ? " " + _t(" & Close") : ""), classes: "btn-primary", click: function () {
                            self.view_form.onchanges_mutex.def.then(function () {
                                if (!self.view_form.warning_displayed) {
                                    $.when(self.view_form.save()).done(function (record_id) {
                                        self.view_form.reload_mutex.exec(function () {
                                            self.trigger('record_saved', record_id);
                                            self.close();
                                        });
                                    });
                                }
                            });
                        }
                    });

                    if (multi_select) {
                        options.buttons.splice(1, 0, {
                            text: _t("Save & New"), classes: "btn-primary", click: function () {
                                $.when(self.view_form.save()).done(function () {
                                    self.view_form.reload_mutex.exec(function () {
                                        self.view_form.on_button_new();
                                    });
                                });
                            }
                        });
                    }
                }
            }

            this._super(parent, options);
        },

        open: function () {
            var self = this;
            var _super = this._super.bind(this);
            this.init_dataset();

            if (this.res_id) {
                this.dataset.ids = [this.res_id];
                this.dataset.index = 0;
            } else {
                this.dataset.index = null;
            }
            var options = _.clone(this.options.form_view_options) || {};
            if (this.res_id !== null) {
                options.initial_mode = this.options.readonly ? "view" : "edit";
            }
            _.extend(options, {
                $buttons: this.$buttons,
            });
            var fields_view_def;
            if (this.options.alternative_form_view) {
                fields_view_def = $.when(this.options.alternative_form_view);
            } else {
                fields_view_def = data_manager.load_fields_view(this.dataset, this.options.view_id, 'form', false);
            }
            fields_view_def.then(function (fields_view) {
                self.view_form = new FormView(self, self.dataset, fields_view, options);
                var fragment = document.createDocumentFragment();
                self.view_form.appendTo(fragment).then(function () {
                    self.view_form.do_show().then(function () {
                        _super().$el.append(fragment);
                        self.view_form.autofocus();
                    });
                });
            });
            return fields_view_def;
        },
    });

    DiagramView.include({

        is_readonly: function () {
            var context = this.ViewManager.action.context;
            return context ? context.edit != undefined && !context.edit : false;
        },

        track_node_position_changes: function () {
            return this.nodes.attrs.xpos != undefined && this.nodes.attrs.ypos != undefined;
        },

        on_node_drag_end: function (e) {
            var self = this;
            var node = e.target.cute_node;
            if (e.target.cute_node == undefined || self.node_updating) return
            self.node_updating = true;
            console.log('Drag event: ', node);
            var params = {
                'id': node.id,
                'node': this.node,
                'xpos': self.nodes.attrs.xpos,
                'ypos': self.nodes.attrs.ypos,
                'x': node.get_pos().x,
                'y': node.get_pos().y
            };

            self.rpc('/web_diagram_position/diagram/update', params).done(function (data) {
                self.on_node_updated(node);
                self.node_updating = false;
            });

        },

        on_node_updated: function (node) {
            console.log('Node updated: ', node);
        },

        get_style: function () {
            return {
                edge_color: "#A0A0A0",
                edge_label_color: "#555",
                edge_label_font_size: 10,
                edge_width: 2,
                edge_spacing: 100,
                edge_loop_radius: 100,

                node_label_color: "#333",
                node_label_font_size: 12,
                node_outline_color: "#333",
                node_outline_width: 1,
                node_selected_color: "#0097BE",
                node_selected_width: 2,
                node_size_x: 110,
                node_size_y: 80,
                connector_active_color: "#FFF",
                connector_radius: 4,

                close_button_radius: 8,
                close_button_color: "#333",
                close_button_x_color: "#FFF",

                gray: "#DCDCDC",
                white: "#FFF",

                viewport_margin: 50
            };
        },

        create_cute_node: function (graph, node, style) {
            return new MyCuteNode(
                graph,
                node.x,
                node.y,
                MyCuteGraph.wordwrap(node.name, 14),
                node.shape === 'rectangle' ? 'rect' : 'circle',
                style[node.color] || style.gray
            );
        },

        create_cute_edge: function (graph, edge, nodes) {
            return new MyCuteEdge(
                graph,
                MyCuteGraph.wordwrap(edge.signal, 32),
                nodes[edge.s_id],
                nodes[edge.d_id] || nodes[edge.s_id] //WORKAROUND
            );
        },

        create_cute_graph: function (r, style, viewport) {
            return new MyCuteGraph(r, style, viewport, {readonly: this.is_readonly()});
        },

        make_cute_node: function (graph, node, style) {
            var n = this.create_cute_node(graph, node, style);
            n.id = node.id;
            this.id_to_node[node.id] = n;
            return n;
        },

        make_tracked_cute_node: function (graph, node, style) {
            var n = this.make_cute_node(graph, node, style);

            var self = this;

            var drag_end = function (e) {
                self.on_node_drag_end(e);
            };

            // Here we need to register cute-node with the Rafael's figure node
            // and we need to subscribe to the drag-end event so we can save (x,y) coordinates with the task state.
            n.get_fig().node.cute_node = n;
            n.get_fig().drag(null, null, drag_end);

            // Also, because the state is compiled out of two Rafael's nodes we need to subscribe to the drag-end event
            // of the Rafael's label node. Now, this is a bit tricky one to do because cute-node does not exposes
            // the actual label node. It only exposes the text of the label node.
            // So here we need to do a bit of mumbo jumbo to make this to work.

            // Here we need to register cute-node with the draggable elements of the Rafel's label node.
            // These elements are ``tspan`` and ``text``.
            n.get_fig().next.node.cute_node = n;
            n.get_fig().next.node.firstChild.cute_node = n;

            // Finally we register drag-end event
            n.get_fig().next.drag(null, null, drag_end);
        },

        // Set-up the drawing elements of the diagram
        // Unfortunately I had to completely overwrite this method so I can implement my custom code.
        draw_diagram: function (result) {
            var self = this;
            var res_nodes = result['nodes'];
            var res_edges = result['conn'];
            this.parent_field = result.parent_field;
            this.id_to_node = {};
            this.id_to_edge = {};

            // Get graph style
            var style = self.get_style();

            // remove previous diagram
            var canvas = self.$('.o_diagram').empty().get(0);

            var r = new Raphael(canvas, '100%', '100%');

            var graph = self.create_cute_graph(r, style, canvas.parentNode);
            this.graph = graph;

            var make_node = this.track_node_position_changes() ? this.make_tracked_cute_node.bind(this) : this.make_cute_node.bind(this);

            _.each(res_nodes, function (node) {
                make_node(graph, node, style);
            });

            _.each(res_edges, function (edge) {
                var e = self.create_cute_edge(graph, edge, self.id_to_node);
                e.id = edge.id;
                self.id_to_edge[e.id] = e;
            });

            MyCuteNode.double_click_callback = function (cutenode) {
                self.edit_node(cutenode.id);
            };
            MyCuteNode.destruction_callback = function (cutenode) {
                if (!confirm(_t("Deleting this node cannot be undone.\nIt will also delete all connected transitions.\n\nAre you sure ?"))) {
                    return $.Deferred().reject().promise();
                }
                return new data.DataSet(self, self.node).unlink([cutenode.id]);
            };
            MyCuteEdge.double_click_callback = function (cuteedge) {
                self.edit_connector(cuteedge.id);
            };

            MyCuteEdge.creation_callback = function (node_start, node_end) {
                return {label: ''};
            };
            MyCuteEdge.new_edge_callback = function (cuteedge) {
                self.add_connector(cuteedge.get_start().id,
                    cuteedge.get_end().id,
                    cuteedge);
            };
            MyCuteEdge.destruction_callback = function (cuteedge) {
                if (!confirm(_t("Deleting this transition cannot be undone.\n\nAre you sure ?"))) {
                    return $.Deferred().reject().promise();
                }
                return new data.DataSet(self, self.connector).unlink([cuteedge.id]);
            };
        },


        // Creates a popup to add a node to the diagram
        add_node: function () {
            if (this.model != 'project.workflow')
                return this._super();

            var self = this;

            var style = self.get_style();

            var make_node = this.track_node_position_changes() ? this.make_tracked_cute_node.bind(this) : this.make_cute_node.bind(this);

            var title = _t('Activity');
            var pop = new FormViewDialog(self, {
                res_model: self.node,
                domain: self.dataset.domain,
                context: self.context || self.dataset.context,
                title: _t("Create:") + title,
                disable_multiple_selection: true,
            });

            var formLoaded = pop.open();

            pop.on("record_saved", this, function (node_id) {
                var params = {
                    'id': node_id,
                    'model': self.node,
                    'bgcolor': self.nodes.attrs.bgcolor,
                    'shape': self.nodes.attrs.shape,
                    'xpos': self.nodes.attrs.xpos || false,
                    'ypos': self.nodes.attrs.ypos || false,
                };

                self.rpc('/web_diagram/diagram/get_node_info', params).done(function (info) {
                    make_node(self.graph, info, style);
                });
            });

            formLoaded.then(function(){
                var form_controller = pop.view_form;
                var form_fields = [self.parent_field];
                form_controller.on("load_record", self, function () {
                    _.each(form_fields, function (fld) {
                        if (!(fld in form_controller.fields)) {
                            return;
                        }
                        var field = form_controller.fields[fld];
                        field.set_value(self.id);
                        field.dirty = true;
                        if (field.$input)
                            field.$input.prop('disabled', true);

                        if (field.$dropdown)
                            field.$dropdown.unbind();
                    });
                });

            });
        },

        // Creates a popup to edit the connector of id connector_id
        edit_connector: function (connector_id) {
            if (this.model != 'project.workflow')
                return this._super(connector_id)

            var self = this;
            var title = _t('Transition');
            var pop = new FormViewDialog(self, {
                res_model: self.connector,
                res_id: parseInt(connector_id, 10),      //FIXME Isn't connector_id supposed to be an int ?
                context: self.context || self.dataset.context,
                title: _t("Open: ") + title
            });

            var formLoaded = pop.open();

            pop.on("record_saved", this, function () {

                var params = {
                    'id': connector_id,
                    'model': self.connector,
                    'source': self.connectors.attrs.source,
                    'destination': self.connectors.attrs.destination,
                    'label': self.connectors.attrs.label,
                };

                self.rpc('/web_diagram/diagram/get_connector_info', params).done(function (info) {
                    let e = self.id_to_edge[info.id];

                    if (e.get_start().id != info[params.source] || e.get_end().id != info[params.destination]) {
                        e.remove(); // Remove from canvas
                        delete self.id_to_edge[e.id];

                        e = self.create_cute_edge(self.graph, info, self.id_to_node);
                        e.id = info.id;
                        self.id_to_edge[e.id] = e;

                    } else {
                        self.id_to_edge[info.id].set_label(info.signal);
                    }

                });
            });

            formLoaded.then(function(){
                var form_fields = [self.parent_field];
                var form_controller = pop.view_form;
                form_controller.on("load_record", self, function () {
                    _.each(form_fields, function (fld) {
                        if (!(fld in form_controller.fields)) {
                            return;
                        }
                        var field = form_controller.fields[fld];

                        if (field.$input)
                            field.$input.prop('disabled', true);

                        if (field.$dropdown)
                            field.$dropdown.unbind();
                    });
                });
            });
        },

        // Creates a popup to edit the content of the node with id node_id
        edit_node: function (node_id) {
            var self = this;
            var title = _t('Activity');
            var pop = new FormViewDialog(self, {
                res_model: self.node,
                res_id: node_id,
                context: self.context || self.dataset.context,
                title: _t("Open: ") + title
            });

            var formLoaded = pop.open();

            pop.on("record_saved", this, () => {
                var params = {
                    'id': node_id,
                    'model': self.node,
                    'bgcolor': self.nodes.attrs.bgcolor,
                    'shape': self.nodes.attrs.shape,
                    'xpos': self.nodes.attrs.xpos || false,
                    'ypos': self.nodes.attrs.ypos || false,
                };

                self.rpc('/web_diagram/diagram/get_node_info', params).done(function (info) {
                    var cute_node = self.id_to_node[info.id];
                    cute_node.set_color(self.get_style()[info.color]);
                    cute_node.set_label(info.name);
                });
            });

            formLoaded.then(function() {
                var form_fields = [self.parent_field];
                var form_controller = pop.view_form;
                form_controller.on("load_record", self, function () {
                    _.each(form_fields, function (fld) {
                        if (!(fld in form_controller.fields)) {
                            return;
                        }
                        var field = form_controller.fields[fld];

                        if (field.$input)
                            field.$input.prop('disabled', true);

                        if (field.$dropdown)
                            field.$dropdown.unbind();
                    });
                });
            });
        },

        // Creates a popup to add a connector from node_source_id to node_dest_id.
        // dummy_cuteedge if not null, will be removed form the graph after the popup is closed.
        add_connector: function (node_source_id, node_dest_id, dummy_cuteedge) {
            if (this.model != 'project.workflow')
                return this._super(node_source_id, node_dest_id, dummy_cuteedge);

            var self = this;
            var title = _t('Transition');
            var pop = new FormViewDialog(self, {
                res_model: self.connector,
                domain: this.dataset.domain,
                context: this.context || this.dataset.context,
                title: _t("Create:") + title,
                disable_multiple_selection: true,
            });

            var formLoaded = pop.open();

            //We want to destroy the dummy edge after a creation cancel. This destroys it even if we save the changes.
            //This is not a problem since the edge is completely redrawn on saved changes.
            pop.$el.parents('.modal').on('hidden.bs.modal', function (e) {
                if (dummy_cuteedge) {
                    dummy_cuteedge.remove();
                }
            });

            pop.on("record_saved", this, function (edge_id) {

                var params = {
                    'id': edge_id,
                    'model': self.connector,
                    'source': self.connectors.attrs.source,
                    'destination': self.connectors.attrs.destination,
                    'label': self.connectors.attrs.label,
                };

                self.rpc('/web_diagram/diagram/get_connector_info', params).done(function (connector) {
                    if (dummy_cuteedge){
                        dummy_cuteedge.remove();
                    }
                    var edge = self.create_cute_edge(self.graph, connector, self.id_to_node);
                    edge.id = connector.id;
                    self.id_to_edge[edge.id] = edge;
                });
            });

            formLoaded.then(function () {
                var form_controller = pop.view_form;
                form_controller.on("load_record", self, function () {
                    console.log("add_connector::load_record (" + node_source_id + "," + node_dest_id + ")");

                    form_controller.fields[self.connectors.attrs.source].set_value(node_source_id);
                    form_controller.fields[self.connectors.attrs.source].dirty = true;
                    form_controller.fields[self.connectors.attrs.destination].set_value(node_dest_id);
                    form_controller.fields[self.connectors.attrs.destination].dirty = true;

                    var field = form_controller.fields[self.parent_field];
                    field.set_value(self.id);
                    field.dirty = true;

                    if (field.$input)
                        field.$input.prop('disabled', true);


                    if (field.$dropdown)
                        field.$dropdown.unbind();
                });
            });
        },

        get_diagram_info_params: function () {
            return {
                'id': this.id,
                'model': this.model,
                'node': this.node,
                'connector': this.connector,
                'bgcolor': this.nodes.attrs.bgcolor,
                'shape': this.nodes.attrs.shape,
                'src_node': this.connectors.attrs.source,
                'des_node': this.connectors.attrs.destination,
                'label': this.connectors.attrs.label || false,
                'visible_nodes': [],
                'invisible_nodes': [],
                'node_fields': [],
                'connectors': [],
                'connectors_fields': [],
                'xpos': this.nodes.attrs.xpos || false,
                'ypos': this.nodes.attrs.ypos || false,
            };
        },

        get_diagram_info: function () {
            var self = this;
            var params = self.get_diagram_info_params();

            _.each(this.nodes.children, function (child) {
                if (child.attrs.invisible === '1')
                    params.invisible_nodes.push(child.attrs.name);
                else {
                    params.visible_nodes.push(child.attrs.name);
                    params.node_fields.push(self.fields[child.attrs.name]['string'] || this.toTitleCase(child.attrs.name));
                }
            });

            _.each(this.connectors.children, function (conn) {
                params.connectors_fields.push(self.fields[conn.attrs.name]['string'] || this.toTitleCase(conn.attrs.name));
                params.connectors.push(conn.attrs.name);
            });
            this.rpc(
                '/web_diagram/diagram/get_diagram_info', params).done(function (result) {
                    self.draw_diagram(result);
                }
            );
        },
    });

    return DiagramView;
});
