// Copyright 2017 - 2018 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

"use strict";
odoo.define('web.syncer', function (require) {

    const bus = require('bus.bus');
    window.busx = bus.bus;
    const session = require('web.session');

    const PARTNERS_PRESENCE_CHECK_PERIOD = 30000;  // don't check presence more than once every 30s


    // Extend Bus so that adding new channels immediately sends poll request with updated channel list
    bus.Bus.include({
        poll: function () {
            var self = this;
            self.activated = true;
            // We are storing lastPoolTimestamp on bus, so that we can compare it with timestamp when request was created.
            // If those two doesn't match, then we should ignore response.
            var now = this.lastPoolTimestamp = new Date().getTime();
            var options = _.extend({}, this.options, {
                bus_inactivity: now - this.get_last_presence(),
            });
            if (this.last_partners_presence_check + PARTNERS_PRESENCE_CHECK_PERIOD > now) {
                options = _.omit(options, 'bus_presence_partner_ids');
            } else {
                this.last_partners_presence_check = now;
            }
            var data = {channels: self.channels, last: self.last, options: options};
            this.request = window.rpcRequest = session.rpc('/longpolling/poll', data, {shadow: true}).then(function (result) {
                if (this.lastPoolTimestamp !== now) {
                    return;
                }
                self.on_notification(result);
                if (!self.stop) {
                    self.poll();
                }
            }.bind(this), function (unused, e) {
                if (this.lastPoolTimestamp !== now) {
                    return;
                }
                // no error popup if request is interrupted or fails for any reason
                e.preventDefault();
                // random delay to avoid massive longpolling
                setTimeout(_.bind(self.poll, self), bus.ERROR_DELAY + (Math.floor((Math.random() * 20) + 1) * 1000));
            }.bind(this));
        },
        add_channel: function (channel) {
            this.channels.push(channel);
            this.channels = _.uniq(this.channels);
            if (this.is_master) {
                this.poll();
            }
        },
        delete_channel: function (channel) {
            this.channels = _.without(this.channels, channel);
            if (this.is_master) {
                this.poll();
            }

        },
    });

    class Callback {
        constructor(syncer, channel, callback) {
            this.syncer = syncer;
            this.channel = channel;
            this.callback = callback;
        }

        unsubscribe() {
            let callbackList = this.syncer.subscriptions.get(this.channel);
            callbackList.splice(callbackList.indexOf(this), 1);
        }
    };

    class Syncer {

        constructor(parent = null) {
            this.subscriptions = new Map();
        }

        subscribe(channel, callback, parent = {}) {
            if (typeof callback !== "function") {
                throw new Error("Syncer subscription needs to have callback of type function");
            }

            bus.bus.add_channel(channel);
            let callbackObj = new Callback(this, channel, callback.bind(parent));
            if (!this.subscriptions.has(channel)) {
                this.subscriptions.set(channel, [callbackObj])
            }
            else {
                this.subscriptions.get(channel).push(callbackObj);
            }

            if (bus.bus.channels.length == 1) {
                this.setupListener()
            }
            return callbackObj;
        }

        setupListener(parent) {
            bus.bus.on('notification', parent, notifications => {
                notifications.forEach(notification => {
                    if (this.subscriptions.has(notification[0])) {
                        this._notify(notification[0], notification[1]);
                    }
                });
            });
            bus.bus.start_polling();
        }

        sendMessage(channel, message) {
            session.rpc("/longpolling/send", {channel, message});
        }

        _notify(channel, message) {
            if (this.subscriptions.has(channel)) {
                let callbacks = this.subscriptions.get(channel);
                callbacks.forEach(callback => callback.callback(message));
            }
        }

    }

    return {
        Callback,
        Syncer
    }
});