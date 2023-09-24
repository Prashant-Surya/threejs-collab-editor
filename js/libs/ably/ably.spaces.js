var Spaces = (function (exports, Ably, nanoid) {
    'use strict';

    function typeOf(arg) {
        return Object.prototype.toString.call(arg).slice(8, -1);
    }
    // Equivalent of Util.isObject from ably-js
    function isObject(arg) {
        return typeOf(arg) === 'Object';
    }
    function isFunction(arg) {
        return typeOf(arg) === 'Function';
    }
    function isString(arg) {
        return typeOf(arg) === 'String';
    }
    function isArray(arg) {
        return Array.isArray(arg);
    }

    function callListener(eventThis, listener, args) {
        try {
            listener.apply(eventThis, args);
        }
        catch (e) {
            console.error('EventEmitter.emit()', 'Unexpected listener exception: ' + e + '; stack = ' + (e && e.stack));
        }
    }
    /**
     * Remove listeners that match listener
     * @param targetListeners is an array of listener arrays or event objects with arrays of listeners
     * @param listener the listener callback to remove
     * @param eventFilter (optional) event name instructing the function to only remove listeners for the specified event
     */
    function removeListener(targetListeners, listener, eventFilter) {
        let listeners;
        let index;
        let eventName;
        for (let targetListenersIndex = 0; targetListenersIndex < targetListeners.length; targetListenersIndex++) {
            listeners = targetListeners[targetListenersIndex];
            if (isString(eventFilter) && isObject(listeners)) {
                listeners = listeners[eventFilter];
            }
            if (isArray(listeners)) {
                while ((index = listeners.indexOf(listener)) !== -1) {
                    listeners.splice(index, 1);
                }
                /* If events object has an event name key with no listeners then
                           remove the key to stop the list growing indefinitely */
                const parentCollection = targetListeners[targetListenersIndex];
                if (eventFilter && listeners.length === 0 && isObject(parentCollection)) {
                    delete parentCollection[eventFilter];
                }
            }
            else if (isObject(listeners)) {
                for (eventName in listeners) {
                    if (Object.prototype.hasOwnProperty.call(listeners, eventName) && isArray(listeners[eventName])) {
                        removeListener([listeners], listener, eventName);
                    }
                }
            }
        }
    }
    // Equivalent of Platform.config.inspect from ably-js for browser/RN
    function inspect(args) {
        return JSON.stringify(args);
    }
    class InvalidArgumentError extends Error {
        constructor(...args) {
            super(...args);
        }
    }
    class EventEmitter {
        constructor() {
            this.any = [];
            this.events = Object.create(null);
            this.anyOnce = [];
            this.eventsOnce = Object.create(null);
        }
        /**
         * Add an event listener
         * @param listenerOrEvents (optional) the name of the event to listen to or the listener to be called.
         * @param listener (optional) the listener to be called.
         */
        on(listenerOrEvents, listener) {
            // .on(() => {})
            if (isFunction(listenerOrEvents)) {
                this.any.push(listenerOrEvents);
                return;
            }
            // .on("eventName", () => {})
            if (isString(listenerOrEvents) && isFunction(listener)) {
                const listeners = this.events[listenerOrEvents] || (this.events[listenerOrEvents] = []);
                listeners.push(listener);
                return;
            }
            // .on(["eventName"], () => {})
            if (isArray(listenerOrEvents) && isFunction(listener)) {
                listenerOrEvents.forEach((eventName) => {
                    this.on(eventName, listener);
                });
                return;
            }
            throw new InvalidArgumentError('EventEmitter.on(): Invalid arguments: ' + inspect([listenerOrEvents, listener]));
        }
        /**
         * Remove one or more event listeners
         * @param listenerOrEvents (optional) the name of the event whose listener is to be removed. If not supplied,
         * the listener is treated as an 'any' listener.
         * @param listener (optional) the listener to remove. If not supplied, all listeners are removed.
         */
        off(listenerOrEvents, listener) {
            // .off()
            // don't use arguments.length === 0 here as don't won't handle
            // cases like .off(undefined) which is a valid call
            if (!listenerOrEvents && !listener) {
                this.any = [];
                this.events = Object.create(null);
                this.anyOnce = [];
                this.eventsOnce = Object.create(null);
                return;
            }
            // .off(() => {})
            if (isFunction(listenerOrEvents)) {
                removeListener([this.any, this.events, this.anyOnce, this.eventsOnce], listenerOrEvents);
                return;
            }
            // .off("eventName", () => {})
            if (isString(listenerOrEvents) && isFunction(listener)) {
                removeListener([this.events, this.eventsOnce], listener, listenerOrEvents);
                return;
            }
            // .off("eventName")
            if (isString(listenerOrEvents)) {
                delete this.events[listenerOrEvents];
                delete this.eventsOnce[listenerOrEvents];
                return;
            }
            // .off(["eventName"], () => {})
            if (isArray(listenerOrEvents) && isFunction(listener)) {
                listenerOrEvents.forEach((eventName) => {
                    this.off(eventName, listener);
                });
                return;
            }
            // .off(["eventName"])
            if (isArray(listenerOrEvents)) {
                listenerOrEvents.forEach((eventName) => {
                    this.off(eventName);
                });
                return;
            }
            throw new InvalidArgumentError('EventEmitter.off(): invalid arguments:' + inspect([listenerOrEvents, listener]));
        }
        /**
         * Get the array of listeners for a given event; excludes once events
         * @param event (optional) the name of the event, or none for 'any'
         * @return array of events, or null if none
         */
        listeners(event) {
            var _a;
            if (event) {
                const listeners = [...((_a = this.events[event]) !== null && _a !== void 0 ? _a : [])];
                if (isArray(this.eventsOnce[event])) {
                    Array.prototype.push.apply(listeners, this.eventsOnce[event]);
                }
                return listeners.length ? listeners : null;
            }
            return this.any.length ? this.any : null;
        }
        /**
         * Emit an event
         * @param event the event name
         * @param arg the arguments to pass to the listener
         */
        emit(event, arg) {
            const eventThis = { event };
            const listeners = [];
            if (this.anyOnce.length > 0) {
                Array.prototype.push.apply(listeners, this.anyOnce);
                this.anyOnce = [];
            }
            if (this.any.length > 0) {
                Array.prototype.push.apply(listeners, this.any);
            }
            const eventsOnceListeners = this.eventsOnce[event];
            if (eventsOnceListeners) {
                Array.prototype.push.apply(listeners, eventsOnceListeners);
                delete this.eventsOnce[event];
            }
            const eventsListeners = this.events[event];
            if (eventsListeners) {
                Array.prototype.push.apply(listeners, eventsListeners);
            }
            listeners.forEach(function (listener) {
                callListener(eventThis, listener, [arg]);
            });
        }
        /**
         * Listen for a single occurrence of an event
         * @param listenerOrEvents (optional) the name of the event to listen to
         * @param listener (optional) the listener to be called
         */
        once(listenerOrEvents, listener) {
            // .once("eventName", () => {})
            if (isString(listenerOrEvents) && isFunction(listener)) {
                const listeners = this.eventsOnce[listenerOrEvents] || (this.eventsOnce[listenerOrEvents] = []);
                listeners.push(listener);
                return;
            }
            // .once(["eventName"], () => {})
            if (isArray(listenerOrEvents) && isFunction(listener)) {
                const self = this;
                listenerOrEvents.forEach(function (eventName) {
                    const listenerWrapper = function (listenerThis) {
                        const innerArgs = Array.prototype.slice.call(arguments);
                        listenerOrEvents.forEach((eventName) => {
                            self.off(eventName, this);
                        });
                        listener.apply(listenerThis, innerArgs);
                    };
                    self.once(eventName, listenerWrapper);
                });
                return;
            }
            // .once(() => {})
            if (isFunction(listenerOrEvents)) {
                this.anyOnce.push(listenerOrEvents);
                return;
            }
            throw new InvalidArgumentError('EventEmitter.once(): invalid arguments:' + inspect([listenerOrEvents, listener]));
        }
        /**
         * Private API
         *
         * Listen for a single occurrence of a state event and fire immediately if currentState matches targetState
         * @param targetState the name of the state event to listen to
         * @param currentState the name of the current state of this object
         * @param listener the listener to be called
         * @param listenerArgs
         */
        whenState(targetState, currentState, listener, ...listenerArgs) {
            const eventThis = { event: targetState };
            if (typeof targetState !== 'string' || typeof currentState !== 'string') {
                throw 'whenState requires a valid event String argument';
            }
            if (typeof listener !== 'function' && Promise) {
                return new Promise((resolve) => {
                    EventEmitter.prototype.whenState.apply(this, [targetState, currentState, resolve].concat(listenerArgs));
                });
            }
            if (targetState === currentState) {
                callListener(eventThis, listener, listenerArgs);
            }
            else {
                this.once(targetState, listener);
            }
        }
    }

    class Locations extends EventEmitter {
        constructor(space, presenceUpdate) {
            super();
            this.space = space;
            this.presenceUpdate = presenceUpdate;
            this.lastLocationUpdate = {};
        }
        async processPresenceMessage(message) {
            // Only an update action is currently a valid location update.
            if (message.action !== 'update')
                return;
            // Emit updates only if they are different than the last held update.
            if (!message.data.locationUpdate.id ||
                this.lastLocationUpdate[message.connectionId] === message.data.locationUpdate.id) {
                return;
            }
            const update = message.data.locationUpdate;
            const { previous } = update;
            const member = await this.space.members.getByConnectionId(message.connectionId);
            if (member) {
                this.emit('update', {
                    member,
                    currentLocation: member.location,
                    previousLocation: previous,
                });
                this.lastLocationUpdate[message.connectionId] = message.data.locationUpdate.id;
            }
        }
        async set(location) {
            const self = await this.space.members.getSelf();
            if (!self) {
                throw new Error('You must enter a space before setting a location.');
            }
            const update = {
                profileUpdate: {
                    id: null,
                    current: self.profileData,
                },
                locationUpdate: {
                    id: nanoid.nanoid(),
                    previous: self.location,
                    current: location,
                },
            };
            const extras = this.space.locks.getLockExtras(self.connectionId);
            await this.presenceUpdate(update, extras);
        }
        subscribe(listenerOrEvents, listener) {
            try {
                super.on(listenerOrEvents, listener);
            }
            catch (e) {
                if (e instanceof InvalidArgumentError) {
                    throw new InvalidArgumentError('Locations.subscribe(): Invalid arguments: ' + inspect([listenerOrEvents, listener]));
                }
                else {
                    throw e;
                }
            }
        }
        unsubscribe(listenerOrEvents, listener) {
            try {
                super.off(listenerOrEvents, listener);
            }
            catch (e) {
                if (e instanceof InvalidArgumentError) {
                    throw new InvalidArgumentError('Locations.unsubscribe(): Invalid arguments: ' + inspect([listenerOrEvents, listener]));
                }
                else {
                    throw e;
                }
            }
        }
        async getSelf() {
            const self = await this.space.members.getSelf();
            return self ? self.location : null;
        }
        async getOthers() {
            const members = await this.space.members.getOthers();
            return members.reduce((acc, member) => {
                acc[member.connectionId] = member.location;
                return acc;
            }, {});
        }
        async getAll() {
            const members = await this.space.members.getAll();
            return members.reduce((acc, member) => {
                acc[member.connectionId] = member.location;
                return acc;
            }, {});
        }
    }

    const CURSOR_UPDATE = 'cursorUpdate';

    class CursorBatching {
        constructor(outboundBatchInterval) {
            this.outboundBatchInterval = outboundBatchInterval;
            this.outgoingBuffer = [];
            // Set to `true` when a cursor position is in the buffer
            this.hasMovement = false;
            // Set to `true` when the buffer is actively being emptied
            this.isRunning = false;
            // Set to `true` if there is more than one user listening to cursors
            this.shouldSend = false;
            // Used for tracking offsets in the buffer
            this.bufferStartTimestamp = 0;
            this.batchTime = outboundBatchInterval;
        }
        pushCursorPosition(channel, cursor) {
            // Ignore the cursor update if there is no one listening
            if (!this.shouldSend)
                return;
            const timestamp = new Date().getTime();
            let offset;
            // First update in the buffer is always 0
            if (this.outgoingBuffer.length === 0) {
                offset = 0;
                this.bufferStartTimestamp = timestamp;
            }
            else {
                // Add the offset compared to the first update in the buffer
                offset = timestamp - this.bufferStartTimestamp;
            }
            this.hasMovement = true;
            this.pushToBuffer({ cursor, offset });
            this.publishFromBuffer(channel, CURSOR_UPDATE);
        }
        setShouldSend(shouldSend) {
            this.shouldSend = shouldSend;
        }
        setBatchTime(batchTime) {
            this.batchTime = batchTime;
        }
        pushToBuffer(value) {
            this.outgoingBuffer.push(value);
        }
        async publishFromBuffer(channel, eventName) {
            if (!this.isRunning) {
                this.isRunning = true;
                await this.batchToChannel(channel, eventName);
            }
        }
        async batchToChannel(channel, eventName) {
            if (!this.hasMovement) {
                this.isRunning = false;
                return;
            }
            // Must be copied here to avoid a race condition where the buffer is cleared before the publish happens
            const bufferCopy = [...this.outgoingBuffer];
            channel.publish(eventName, bufferCopy);
            setTimeout(() => this.batchToChannel(channel, eventName), this.batchTime);
            this.outgoingBuffer = [];
            this.hasMovement = false;
            this.isRunning = true;
        }
    }

    class CursorDispensing {
        constructor(emitCursorUpdate) {
            this.emitCursorUpdate = emitCursorUpdate;
            this.buffer = {};
        }
        setEmitCursorUpdate(update) {
            this.emitCursorUpdate(update);
        }
        emitFromBatch() {
            for (let connectionId in this.buffer) {
                const buffer = this.buffer[connectionId];
                const update = buffer.shift();
                if (!update)
                    continue;
                setTimeout(() => this.setEmitCursorUpdate(update.cursor), update.offset);
            }
            if (this.bufferHaveData()) {
                this.emitFromBatch();
            }
        }
        bufferHaveData() {
            return (Object.entries(this.buffer)
                .map(([, v]) => v)
                .flat().length > 0);
        }
        processBatch(message) {
            const updates = message.data || [];
            updates.forEach((update) => {
                const enhancedMsg = {
                    cursor: {
                        clientId: message.clientId,
                        connectionId: message.connectionId,
                        position: update.cursor.position,
                        data: update.cursor.data,
                    },
                    offset: update.offset,
                };
                if (this.buffer[enhancedMsg.cursor.connectionId]) {
                    this.buffer[enhancedMsg.cursor.connectionId].push(enhancedMsg);
                }
                else {
                    this.buffer[enhancedMsg.cursor.connectionId] = [enhancedMsg];
                }
            });
            if (this.bufferHaveData()) {
                this.emitFromBatch();
            }
        }
    }

    class CursorHistory {
        constructor() { }
        positionsMissing(connections) {
            return Object.keys(connections).some((connectionId) => connections[connectionId] === null);
        }
        messageToUpdate(connectionId, clientId, update) {
            return {
                clientId,
                connectionId,
                position: update.position,
                data: update.data,
            };
        }
        allCursorUpdates(connections, page) {
            return Object.fromEntries(Object.entries(connections).map(([connectionId, cursors]) => {
                const lastMessage = page.items.find((item) => item.connectionId === connectionId);
                if (!lastMessage)
                    return [connectionId, cursors];
                const { data, clientId } = lastMessage;
                const lastUpdate = (data === null || data === void 0 ? void 0 : data.length) > 0 ? this.messageToUpdate(connectionId, clientId, data[data.length - 1]) : null;
                return [connectionId, lastUpdate];
            }));
        }
        async getLastCursorUpdate(channel, paginationLimit) {
            const members = await channel.presence.get();
            if (members.length === 0)
                return {};
            let connections = members.reduce((acc, member) => ({
                ...acc,
                [member.connectionId]: null,
            }), {});
            const history = await channel.history();
            let pageNo = 1;
            let page = await history.current();
            connections = this.allCursorUpdates(connections, page);
            pageNo++;
            while (pageNo <= paginationLimit && this.positionsMissing(connections) && history.hasNext()) {
                page = await history.next();
                connections = this.allCursorUpdates(connections, page);
                pageNo++;
            }
            return connections;
        }
    }

    class Cursors extends EventEmitter {
        constructor(space) {
            super();
            this.space = space;
            this.emitterHasListeners = (emitter) => {
                const flattenEvents = (obj) => Object.entries(obj)
                    .map((_, v) => v)
                    .flat();
                return (emitter.any.length > 0 ||
                    emitter.anyOnce.length > 0 ||
                    flattenEvents(emitter.events).length > 0 ||
                    flattenEvents(emitter.eventsOnce).length > 0);
            };
            this.options = this.space.options.cursors;
            this.cursorHistory = new CursorHistory();
            this.cursorBatching = new CursorBatching(this.options.outboundBatchInterval);
            const emitCursorUpdate = (update) => this.emit('update', update);
            this.cursorDispensing = new CursorDispensing(emitCursorUpdate);
        }
        /**
         * Schedules a cursor update event to be sent that will cause the following events to fire
         *
         * @param {CursorUpdate} cursor
         * @return {void}
         */
        async set(cursor) {
            const self = await this.space.members.getSelf();
            if (!self) {
                throw new Error('Must enter a space before setting a cursor update');
            }
            const channel = this.getChannel();
            this.cursorBatching.pushCursorPosition(channel, cursor);
        }
        getChannel() {
            var _a;
            return (_a = this.channel) !== null && _a !== void 0 ? _a : (this.channel = this.initializeCursorsChannel());
        }
        initializeCursorsChannel() {
            const spaceChannelName = this.space.channelName;
            const channel = this.space.client.channels.get(`${spaceChannelName}_cursors`);
            channel.presence.subscribe(this.onPresenceUpdate.bind(this));
            channel.presence.enter();
            return channel;
        }
        async onPresenceUpdate() {
            const channel = this.getChannel();
            const cursorsMembers = await channel.presence.get();
            this.cursorBatching.setShouldSend(cursorsMembers.length > 1);
            this.cursorBatching.setBatchTime((cursorsMembers.length - 1) * this.options.outboundBatchInterval);
        }
        isUnsubscribed() {
            const channel = this.getChannel();
            const subscriptions = channel.subscriptions;
            return !this.emitterHasListeners(subscriptions);
        }
        subscribe(listenerOrEvents, listener) {
            try {
                super.on(listenerOrEvents, listener);
            }
            catch (e) {
                if (e instanceof InvalidArgumentError) {
                    throw new InvalidArgumentError('Cursors.subscribe(): Invalid arguments: ' + inspect([listenerOrEvents, listener]));
                }
                else {
                    throw e;
                }
            }
            if (this.isUnsubscribed()) {
                const channel = this.getChannel();
                channel.subscribe(CURSOR_UPDATE, (message) => {
                    this.cursorDispensing.processBatch(message);
                });
            }
        }
        unsubscribe(listenerOrEvents, listener) {
            try {
                super.off(listenerOrEvents, listener);
            }
            catch (e) {
                if (e instanceof InvalidArgumentError) {
                    throw new InvalidArgumentError('Cursors.unsubscribe(): Invalid arguments: ' + inspect([listenerOrEvents, listener]));
                }
                else {
                    throw e;
                }
            }
            const hasListeners = this.emitterHasListeners(this);
            if (!hasListeners) {
                const channel = this.getChannel();
                channel.unsubscribe();
            }
        }
        async getSelf() {
            const self = await this.space.members.getSelf();
            if (!self)
                return;
            const allCursors = await this.getAll();
            return allCursors[self.connectionId];
        }
        async getOthers() {
            const self = await this.space.members.getSelf();
            if (!self)
                return {};
            const allCursors = await this.getAll();
            const allCursorsFiltered = allCursors;
            delete allCursorsFiltered[self.connectionId];
            return allCursorsFiltered;
        }
        async getAll() {
            const channel = this.getChannel();
            return await this.cursorHistory.getLastCursorUpdate(channel, this.options.paginationLimit);
        }
    }

    class Leavers {
        constructor(offlineTimeout) {
            this.offlineTimeout = offlineTimeout;
            this.leavers = [];
        }
        getByConnectionId(connectionId) {
            return this.leavers.find((leaver) => leaver.member.connectionId === connectionId);
        }
        getAll() {
            return this.leavers;
        }
        addLeaver(member, timeoutCallback) {
            // remove any existing leaver to prevent old timers from firing
            this.removeLeaver(member.connectionId);
            this.leavers.push({
                member,
                timeoutId: setTimeout(timeoutCallback, this.offlineTimeout),
            });
        }
        removeLeaver(connectionId) {
            const leaverIndex = this.leavers.findIndex((leaver) => leaver.member.connectionId === connectionId);
            if (leaverIndex >= 0) {
                clearTimeout(this.leavers[leaverIndex].timeoutId);
                this.leavers.splice(leaverIndex, 1);
            }
        }
    }

    class Members extends EventEmitter {
        constructor(space) {
            super();
            this.space = space;
            this.lastMemberUpdate = {};
            this.leavers = new Leavers(this.space.options.offlineTimeout);
        }
        async processPresenceMessage(message) {
            const { action, connectionId } = message;
            const isLeaver = !!this.leavers.getByConnectionId(connectionId);
            const member = this.createMember(message);
            if (action === 'leave') {
                this.leavers.addLeaver(member, () => this.onMemberOffline(member));
                this.emit('leave', member);
            }
            else if (isLeaver) {
                this.leavers.removeLeaver(connectionId);
            }
            if (action === 'enter') {
                this.emit('enter', member);
            }
            // Emit profileData updates only if they are different then the last held update.
            // A locationUpdate is handled in Locations.
            if (message.data.profileUpdate.id && this.lastMemberUpdate[connectionId] !== message.data.profileUpdate.id) {
                this.lastMemberUpdate[message.connectionId] = message.data.profileUpdate.id;
                this.emit('update', member);
            }
        }
        async getSelf() {
            return this.space.connectionId ? await this.getByConnectionId(this.space.connectionId) : undefined;
        }
        async getAll() {
            const presenceMembers = await this.space.channel.presence.get();
            const members = presenceMembers.map((m) => this.createMember(m));
            return members.concat(this.leavers.getAll().map((l) => l.member));
        }
        async getOthers() {
            const members = await this.getAll();
            return members.filter((m) => m.connectionId !== this.space.connectionId);
        }
        subscribe(listenerOrEvents, listener) {
            try {
                super.on(listenerOrEvents, listener);
            }
            catch (e) {
                if (e instanceof InvalidArgumentError) {
                    throw new InvalidArgumentError('Members.subscribe(): Invalid arguments: ' + inspect([listenerOrEvents, listener]));
                }
                else {
                    throw e;
                }
            }
        }
        unsubscribe(listenerOrEvents, listener) {
            try {
                super.off(listenerOrEvents, listener);
            }
            catch (e) {
                if (e instanceof InvalidArgumentError) {
                    throw new InvalidArgumentError('Members.unsubscribe(): Invalid arguments: ' + inspect([listenerOrEvents, listener]));
                }
                else {
                    throw e;
                }
            }
        }
        async getByConnectionId(connectionId) {
            const members = await this.getAll();
            return members.find((m) => m.connectionId === connectionId);
        }
        createMember(message) {
            return {
                clientId: message.clientId,
                connectionId: message.connectionId,
                isConnected: message.action !== 'leave',
                profileData: message.data.profileUpdate.current,
                location: message.data.locationUpdate.current,
                lastEvent: {
                    name: message.action,
                    timestamp: message.timestamp,
                },
            };
        }
        async onMemberOffline(member) {
            this.leavers.removeLeaver(member.connectionId);
            this.emit('remove', member);
            if (member.location) {
                this.space.locations.emit('update', {
                    previousLocation: member.location,
                    currentLocation: null,
                    member: { ...member, location: null },
                });
            }
            this.space.emit('update', { members: await this.getAll() });
        }
    }

    // TODO: export ErrorInfo from ably-js and use that instead.
    class ErrorInfo extends Error {
        constructor({ message, code, statusCode }) {
            super(message);
            if (typeof Object.setPrototypeOf !== 'undefined') {
                Object.setPrototypeOf(this, ErrorInfo.prototype);
            }
            this.code = code;
            this.statusCode = statusCode;
        }
    }
    const ERR_LOCK_REQUEST_EXISTS = new ErrorInfo({
        message: 'lock request already exists',
        code: 40050,
        statusCode: 400,
    });
    const ERR_LOCK_IS_LOCKED = new ErrorInfo({
        message: 'lock is currently locked',
        code: 40051,
        statusCode: 400,
    });
    const ERR_LOCK_INVALIDATED = new ErrorInfo({
        message: 'lock was invalidated by a concurrent lock request which now holds the lock',
        code: 40052,
        statusCode: 400,
    });
    const ERR_LOCK_RELEASED = new ErrorInfo({
        message: 'lock was released',
        code: 40053,
        statusCode: 400,
    });

    class LockAttributes extends Map {
        toJSON() {
            return Object.fromEntries(this);
        }
    }
    class Locks extends EventEmitter {
        constructor(space, presenceUpdate) {
            super();
            this.space = space;
            this.presenceUpdate = presenceUpdate;
            this.locks = new Map();
        }
        get(id) {
            const locks = this.locks.get(id);
            if (!locks)
                return;
            for (const lock of locks.values()) {
                if (lock.request.status === 'locked') {
                    return lock;
                }
            }
        }
        getAll() {
            const allLocks = [];
            for (const locks of this.locks.values()) {
                for (const lock of locks.values()) {
                    if (lock.request.status === 'locked') {
                        allLocks.push(lock);
                    }
                }
            }
            return allLocks;
        }
        async acquire(id, opts) {
            const self = await this.space.members.getSelf();
            if (!self) {
                throw new Error('Must enter a space before acquiring a lock');
            }
            // check there isn't an existing PENDING or LOCKED request for the current
            // member, since we do not support nested locks
            let req = this.getLockRequest(id, self.connectionId);
            if (req && req.status !== 'unlocked') {
                throw ERR_LOCK_REQUEST_EXISTS;
            }
            // initialise a new PENDING request
            req = {
                id,
                status: 'pending',
                timestamp: Date.now(),
            };
            if (opts) {
                req.attributes = opts.attributes;
            }
            this.setLock({ member: self, request: req });
            // reflect the change in the member's presence data
            await this.updatePresence(self);
            return req;
        }
        async release(id) {
            const self = await this.space.members.getSelf();
            if (!self) {
                throw new Error('Must enter a space before acquiring a lock');
            }
            this.deleteLock(id, self.connectionId);
            await this.updatePresence(self);
        }
        subscribe(listenerOrEvents, listener) {
            try {
                super.on(listenerOrEvents, listener);
            }
            catch (e) {
                if (e instanceof InvalidArgumentError) {
                    throw new InvalidArgumentError('Locks.subscribe(): Invalid arguments: ' + inspect([listenerOrEvents, listener]));
                }
                else {
                    throw e;
                }
            }
        }
        unsubscribe(listenerOrEvents, listener) {
            try {
                super.off(listenerOrEvents, listener);
            }
            catch (e) {
                if (e instanceof InvalidArgumentError) {
                    throw new InvalidArgumentError('Locks.unsubscribe(): Invalid arguments: ' + inspect([listenerOrEvents, listener]));
                }
                else {
                    throw e;
                }
            }
        }
        async processPresenceMessage(message) {
            var _a;
            const member = await this.space.members.getByConnectionId(message.connectionId);
            if (!member)
                return;
            if (message.action === 'leave' || !Array.isArray((_a = message === null || message === void 0 ? void 0 : message.extras) === null || _a === void 0 ? void 0 : _a.locks)) {
                // the member has left, or they have no locks in presence, so release any
                // existing locks for that member
                for (const locks of this.locks.values()) {
                    const lock = locks.get(member.connectionId);
                    if (lock) {
                        lock.request.status = 'unlocked';
                        lock.request.reason = ERR_LOCK_RELEASED;
                        locks.delete(member.connectionId);
                        this.emit('update', lock);
                    }
                }
                return;
            }
            message.extras.locks.forEach((lock) => {
                const existing = this.getLockRequest(lock.id, member.connectionId);
                // special-case the handling of PENDING requests, which will eventually
                // be done by the Ably system, at which point this can be removed
                if (lock.status === 'pending' && (!existing || existing.status === 'pending')) {
                    this.processPending(member, lock);
                }
                if (!existing || existing.status !== lock.status) {
                    this.emit('update', { member, request: lock });
                }
                this.setLock({ member, request: lock });
            });
            // handle locks which have been removed from presence extras
            for (const locks of this.locks.values()) {
                const lock = locks.get(member.connectionId);
                if (!lock) {
                    continue;
                }
                if (!message.extras.locks.some((req) => req.id === lock.request.id)) {
                    lock.request.status = 'unlocked';
                    lock.request.reason = ERR_LOCK_RELEASED;
                    locks.delete(member.connectionId);
                    this.emit('update', lock);
                }
            }
        }
        // process a PENDING lock request by determining whether it should be
        // considered LOCKED or UNLOCKED with a reason, potentially invalidating
        // existing LOCKED requests.
        //
        // TODO: remove this once the Ably system processes PENDING requests
        //       internally using this same logic.
        processPending(member, pendingReq) {
            // if the requested lock ID is not currently locked, then mark the PENDING
            // request as LOCKED
            const lock = this.get(pendingReq.id);
            if (!lock) {
                pendingReq.status = 'locked';
                return;
            }
            // check if the PENDING lock should invalidate the existing LOCKED request.
            //
            // This is necessary because presence data is eventually consistent, so
            // there's no guarantee that all members see presence messages in the same
            // order, which could lead to members not agreeing which members hold which
            // locks.
            //
            // For example, if two members both request the same lock at roughly the
            // same time, and both members see their own request in presence before
            // seeing the other's request, then they will each consider themselves to
            // hold the lock.
            //
            // To minimise the impact of this propagation issue, a further check is
            // made allowing a PENDING request to invalidate an existing LOCKED request
            // if the PENDING request has a timestamp which predates the LOCKED
            // request, or, if the timestamps are the same, if the PENDING request has
            // a connectionId which sorts lexicographically before the connectionId of
            // the LOCKED request.
            if (pendingReq.timestamp < lock.request.timestamp ||
                (pendingReq.timestamp == lock.request.timestamp && member.connectionId < lock.member.connectionId)) {
                pendingReq.status = 'locked';
                lock.request.status = 'unlocked';
                lock.request.reason = ERR_LOCK_INVALIDATED;
                this.emit('update', lock);
                return;
            }
            // the lock is LOCKED and the PENDING request did not invalidate it, so
            // mark the PENDING request as UNLOCKED with a reason.
            pendingReq.status = 'unlocked';
            pendingReq.reason = ERR_LOCK_IS_LOCKED;
        }
        updatePresence(member) {
            var _a;
            const update = {
                profileUpdate: {
                    id: null,
                    current: member.profileData,
                },
                locationUpdate: {
                    id: null,
                    current: (_a = member === null || member === void 0 ? void 0 : member.location) !== null && _a !== void 0 ? _a : null,
                    previous: null,
                },
            };
            return this.presenceUpdate(update, this.getLockExtras(member.connectionId));
        }
        getLock(id, connectionId) {
            const locks = this.locks.get(id);
            if (!locks)
                return;
            return locks.get(connectionId);
        }
        setLock(lock) {
            let locks = this.locks.get(lock.request.id);
            if (!locks) {
                locks = new Map();
                this.locks.set(lock.request.id, locks);
            }
            locks.set(lock.member.connectionId, lock);
        }
        deleteLock(id, connectionId) {
            const locks = this.locks.get(id);
            if (!locks)
                return;
            return locks.delete(connectionId);
        }
        getLockRequest(id, connectionId) {
            const lock = this.getLock(id, connectionId);
            if (!lock)
                return;
            return lock.request;
        }
        getLockRequests(connectionId) {
            const requests = [];
            for (const locks of this.locks.values()) {
                const lock = locks.get(connectionId);
                if (lock) {
                    requests.push(lock.request);
                }
            }
            return requests;
        }
        getLockExtras(connectionId) {
            const locks = this.getLockRequests(connectionId);
            if (locks.length === 0)
                return;
            return { locks };
        }
    }

    const SPACE_CHANNEL_PREFIX = '_ably_space_';
    const SPACE_OPTIONS_DEFAULTS = {
        offlineTimeout: 120000,
        cursors: {
            outboundBatchInterval: 100,
            paginationLimit: 5,
        },
    };
    class Space extends EventEmitter {
        constructor(name, client, options) {
            super();
            this.client = client;
            this.presenceUpdate = (data, extras) => {
                if (!extras) {
                    return this.channel.presence.update(data);
                }
                return this.channel.presence.update(Ably.Realtime.PresenceMessage.fromValues({ data, extras }));
            };
            this.presenceEnter = (data, extras) => {
                if (!extras) {
                    return this.channel.presence.enter(data);
                }
                return this.channel.presence.enter(Ably.Realtime.PresenceMessage.fromValues({ data, extras }));
            };
            this.presenceLeave = (data, extras) => {
                if (!extras) {
                    return this.channel.presence.leave(data);
                }
                return this.channel.presence.leave(Ably.Realtime.PresenceMessage.fromValues({ data, extras }));
            };
            this.options = this.setOptions(options);
            this.connectionId = this.client.connection.id;
            this.channelName = `${SPACE_CHANNEL_PREFIX}${name}`;
            this.channel = this.client.channels.get(this.channelName);
            this.onPresenceUpdate = this.onPresenceUpdate.bind(this);
            this.channel.presence.subscribe(this.onPresenceUpdate);
            this.locations = new Locations(this, this.presenceUpdate);
            this.cursors = new Cursors(this);
            this.members = new Members(this);
            this.locks = new Locks(this, this.presenceUpdate);
        }
        setOptions(options) {
            var _a, _b, _c, _d, _e;
            const { offlineTimeout, cursors: { outboundBatchInterval, paginationLimit }, } = SPACE_OPTIONS_DEFAULTS;
            return {
                offlineTimeout: (_a = options === null || options === void 0 ? void 0 : options.offlineTimeout) !== null && _a !== void 0 ? _a : offlineTimeout,
                cursors: {
                    outboundBatchInterval: (_c = (_b = options === null || options === void 0 ? void 0 : options.cursors) === null || _b === void 0 ? void 0 : _b.outboundBatchInterval) !== null && _c !== void 0 ? _c : outboundBatchInterval,
                    paginationLimit: (_e = (_d = options === null || options === void 0 ? void 0 : options.cursors) === null || _d === void 0 ? void 0 : _d.paginationLimit) !== null && _e !== void 0 ? _e : paginationLimit,
                },
            };
        }
        async onPresenceUpdate(message) {
            await this.members.processPresenceMessage(message);
            await this.locations.processPresenceMessage(message);
            await this.locks.processPresenceMessage(message);
            this.emit('update', { members: await this.members.getAll() });
        }
        async enter(profileData = null) {
            return new Promise((resolve) => {
                const presence = this.channel.presence;
                presence.subscriptions.once('enter', async () => {
                    const presenceMessages = await presence.get();
                    presenceMessages.forEach((msg) => this.locks.processPresenceMessage(msg));
                    const members = await this.members.getAll();
                    resolve(members);
                });
                this.presenceEnter({
                    profileUpdate: {
                        id: nanoid.nanoid(),
                        current: profileData,
                    },
                    locationUpdate: {
                        id: null,
                        current: null,
                        previous: null,
                    },
                });
            });
        }
        async updateProfileData(profileDataOrUpdateFn) {
            var _a;
            const self = await this.members.getSelf();
            if (!isObject(profileDataOrUpdateFn) && !isFunction(profileDataOrUpdateFn)) {
                throw new Error('Space.updateProfileData(): Invalid arguments: ' + inspect([profileDataOrUpdateFn]));
            }
            const update = {
                profileUpdate: {
                    id: nanoid.nanoid(),
                    current: isFunction(profileDataOrUpdateFn) ? profileDataOrUpdateFn(null) : profileDataOrUpdateFn,
                },
                locationUpdate: {
                    id: null,
                    current: (_a = self === null || self === void 0 ? void 0 : self.location) !== null && _a !== void 0 ? _a : null,
                    previous: null,
                },
            };
            if (!self) {
                await this.presenceEnter(update);
                return;
            }
            const extras = this.locks.getLockExtras(self.connectionId);
            return this.presenceUpdate(update, extras);
        }
        async leave(profileData = null) {
            var _a;
            const self = await this.members.getSelf();
            if (!self) {
                throw new Error('You must enter a space before attempting to leave it');
            }
            const update = {
                profileUpdate: {
                    id: profileData ? nanoid.nanoid() : null,
                    current: profileData !== null && profileData !== void 0 ? profileData : null,
                },
                locationUpdate: {
                    id: null,
                    current: (_a = self === null || self === void 0 ? void 0 : self.location) !== null && _a !== void 0 ? _a : null,
                    previous: null,
                },
            };
            await this.presenceLeave(update);
        }
        async getState() {
            const members = await this.members.getAll();
            return { members };
        }
        subscribe(listenerOrEvents, listener) {
            try {
                super.on(listenerOrEvents, listener);
            }
            catch (e) {
                if (e instanceof InvalidArgumentError) {
                    throw new InvalidArgumentError('Space.subscribe(): Invalid arguments: ' + inspect([listenerOrEvents, listener]));
                }
                else {
                    throw e;
                }
            }
        }
        unsubscribe(listenerOrEvents, listener) {
            try {
                super.off(listenerOrEvents, listener);
            }
            catch (e) {
                if (e instanceof InvalidArgumentError) {
                    throw new InvalidArgumentError('Space.unsubscribe(): Invalid arguments: ' + inspect([listenerOrEvents, listener]));
                }
                else {
                    throw e;
                }
            }
        }
    }

    class Spaces {
        constructor(client) {
            this.spaces = {};
            this.version = '0.0.13';
            this.ably = client;
            this.addAgent(this.ably['options']);
            this.ably.time();
        }
        addAgent(options) {
            var _a;
            const agent = { 'ably-spaces': this.version, 'space-custom-client': true };
            options.agents = { ...((_a = options.agents) !== null && _a !== void 0 ? _a : options.agents), ...agent };
        }
        async get(name, options) {
            if (typeof name !== 'string' || name.length === 0) {
                throw new Error('Spaces must have a non-empty name');
            }
            if (this.spaces[name])
                return this.spaces[name];
            if (this.ably.connection.state !== 'connected') {
                await this.ably.connection.once('connected');
            }
            const space = new Space(name, this.ably, options);
            this.spaces[name] = space;
            return space;
        }
    }

    exports.LockAttributes = LockAttributes;
    exports.default = Spaces;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({}, Ably, nanoid);
