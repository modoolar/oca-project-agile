// Copyright 2017 - 2018 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

odoo.define('web_widget_image_url.FieldImageURL', function (require) {
"use strict";

    var core = require('web.core');
    var data = require('web.data');
    var common = require('web.form_common');
    var QWeb = require('web.core').qweb;
    var _t = core._t;

    var FieldImageURL = common.AbstractField.extend(common.ReinitializeFieldMixin, {
        template: 'FieldImageURL',
        placeholder: "/web/static/src/img/placeholder.png",
        render_value: function() {
            var self = this;
            var url;

            if (this.get('value')) {
                url = this.get('value');
            } else {
                url = this.placeholder;
            }

            var $img = $(QWeb.render("FieldImageURL-img", { widget: this, url: url }));

            this.$el.find('> img').remove();
            this.$el.prepend($img);

            $img.load(function() {
                if (! self.options.size)
                    return;
                // $img.css("max-width", "" + self.options.size[0] + "px");
                // $img.css("max-height", "" + self.options.size[1] + "px");
            });
            $img.on('error', function() {
                // self.on_clear();
                $img.attr('src', self.placeholder);
                self.do_warn(_t("Image"), _t("Could not display the selected image."));
            });
        },
        set_value: function(value_){
            var changed = value_ !== this.get_value();
            this._super.apply(this, arguments);
            // By default, on binary images read, the server returns the binary size
            // This is possible that two images have the exact same size
            // Therefore we trigger the change in case the image value hasn't changed
            // So the image is re-rendered correctly
            if (!changed){
                this.trigger("change:value", this, {
                    oldValue: value_,
                    newValue: value_
                });
            }
        }
    });


    core.form_widget_registry
    .add('image_url', FieldImageURL);

    var ColumnImageUrl = core.list_widget_registry.get('field').extend({
        placeholder: "/web/static/src/img/placeholder.png",
        default_width: 16,
        default_height: 16,
        /**
         * Return an actual ``<img>`` tag
         */
        format: function (row_data, options) {
            options = options || {};
            var attrs = {};
            if (options.process_modifiers !== false) {
                attrs = this.modifiers_for(row_data);
            }
            if (attrs.invisible) { return ''; }

            var width = !this.options ? this.default_width : this.options.width || this.default_width;
            var height = !this.options ? this.default_height : this.options.height || this.default_height;

            return QWeb.render('ListView.row.img.url', {
                widget: this,
                url: row_data[this.id].value || this.placeholder,
                width: width,
                height: height,
                disabled: attrs.readonly
                    || isNaN(row_data.id.value)
                    || data.BufferedDataSet.virtual_id_regex.test(row_data.id.value)
            });
        }
    });

    core.list_widget_registry
    .add('field.image-url', ColumnImageUrl);

});