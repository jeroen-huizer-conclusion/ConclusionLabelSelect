define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dijit/_TemplatedMixin",
    "mxui/dom",
    "dojo/dom-class",
    "dojo/dom-style",
    "dojo/dom-construct",
    "dojo/_base/array",
    "dojo/_base/lang",
    "ConclusionLabelSelect/lib/jquery-1.11.2",
    "dojo/text!ConclusionLabelSelect/widget/template/ConclusionLabelSelect.html",
    "ConclusionLabelSelect/lib/jquery-ui",    //Watch out: modified to reference jQuery 
     "ConclusionLabelSelect/lib/tag-it"       //Watch out: modified to reference jQuery AMD style 
], function(declare, _WidgetBase, _TemplatedMixin, dom, domClass, domStyle, domConstruct, dojoArray, lang, _jQuery, widgetTemplate) {
    "use strict";

    var $ = _jQuery.noConflict(true);

    return declare("ConclusionLabelSelect.widget.ConclusionLabelSelect", [_WidgetBase, _TemplatedMixin], {
        templateString: widgetTemplate,

        _handles: null,
        _contextObj: null,
        _listBox: null,
        _tagEntity: null,
        _tagAttribute: null,
        _colorAttribute: null,
        _refAttribute: null,
        _tagCache: null,

        _readOnly: false,

        _constructed: false,

        _notFound: 0, 

        postCreate: function() {
            logger.debug(this.id + ".postCreate");
            //set the variables:
            this._handles = [];
            this._tagEntity = this.tagAssoc.split("/")[1];
            this._refAttribute = this.tagAssoc.split("/")[0];
            this._tagAttribute = this.tagAttrib.split("/")[2];
            this._colorAttribute = this.colorAttrib.split("/")[2];
            this._tagCache = {}; //we need this to set references easily.

            this._readOnly = this.readOnly || this.get("disabled") || this.readonly;
        },

        update: function(obj, callback) {
            logger.debug(this.id + ".update");

            if (!this._constructed) {
                this._listBox = domConstruct.create("ul", {
                    "id": this.id + "_ListBox"
                });
                domConstruct.place(this._listBox, this.domNode);
                this._constructed = true;
            }

            if (obj) {
                domStyle.set(this.domNode, "visibility", "visible");

                this._contextObj = obj;
                this._fetchCurrentLabels(callback);

                this._resetSubscriptions();
            } else {
                domStyle.set(this.domNode, "visibility", "hidden");
                this._executeCallback(callback, "update");
            }
        },

        _fetchCurrentLabels: function(callback) {

            logger.debug(this.id + "._fetchCurrentLabels");

            //fetch all labels
            if(this.datasourceMicroflow){

                // There's something fishy with the callback argument of _execMF
                // this._execMf(this._contextObj, this.datasourceMicroflow, lang.hitch(this, this._processTags, callback));

                mx.data.action({
                    params: {
                        applyto: "selection",
                        actionname: this.datasourceMicroflow,
                        guids: [this._contextObj.getGuid()]
                    },
                    callback: lang.hitch(this, this._processTags, callback),
                    error: function(e) {
                        logger.error("Error running Microflow: " + e);
                    }
                }, this);
            }
            else{
                var xpath = "//" + this._tagEntity + this.tagConstraint.replace(/\[\%CurrentObject\%\]/gi, this._contextObj.getGuid());
                var filters = {};
                if (this.sortAttr && this.sortOrder) {
                    filters.sort = [
                        [this.sortAttr, this.sortOrder]
                    ];
                }

                mx.data.get({
                    xpath: xpath,
                    filter: filters,
                    callback: lang.hitch(this, this._processTags, callback),
                    error: lang.hitch(this, function(err) {
                        console.error(this.id + "._fetchCurrentLabels get failed, err: " + err.toString());
                        this._executeCallback(callback, "_fetchCurrentLabels data err cb");
                    })
                });
            }            
        },

        _processTags: function(callback, objs) {
            logger.debug(this.id + "._processTags");
            var refObjs = this._contextObj.get(this._refAttribute),
                tagArray = [],
                currentTags = [];

            dojoArray.forEach(objs, function(tagObj, index) {
                //clean up the text
                var value = dom.escapeString(tagObj.get(this._tagAttribute));
                //add tag to cache based on value
                this._tagCache[value] = tagObj;
                //check if this is a current tag
                dojoArray.forEach(refObjs, function(ref, i) {
                    if (ref === tagObj.getGuid()) {
                        currentTags.push(tagObj);
                    }
                }, this);
                //push the value to the array.
                tagArray.push(value);
            }, this);

            this._setOptions(tagArray);
            this._renderCurrentTags(currentTags, callback);
        },

        _renderCurrentTags: function(currentTags, callback) {
            logger.debug(this.id + "._renderCurrentTags");
            //we"re not using the plugin function "remove all" because we don"t want to remove references
            var items = this._listBox.getElementsByTagName("li");
            while (items.length > 0) {
                //delete the all tags except the "input" field
                if (!domClass.contains(items[0], "tagit-new")) {
                    domConstruct.destroy(items[0]);
                }
                //break if we"re at the last item and this item is the input field
                if (items.length === 1 && domClass.contains(items[0], "tagit-new")) {
                    break;
                }
            }
            var additionalClass = null,
                duringInitialization = false,
                value = null,
                color = null;
            //create a tag for all items
            dojoArray.forEach(currentTags, function(tagObj, index) {
                value = dom.escapeString(tagObj.get(this._tagAttribute));
                color = (this._colorAttribute) ? dom.escapeString(tagObj.get(this._colorAttribute)) : null;

                $("#" + this.id + "_ListBox").tagit("createTag", value, additionalClass, duringInitialization, color);
            }, this);

            this._executeCallback(callback, "_renderCurrentTags");
        },

        _startTagger: function(options) {
            logger.debug(this.id + "._startTagger");
            if (options) {
                $("#" + this.id + "_ListBox").tagit(options);
            } else {
                //fallback
                logger.warn("No options found, running defaults");
                $("#" + this.id + "_ListBox").tagit();
            }
        },

        _createTagobject: function(value) {
            logger.debug(this.id + "._createTagobject");
            //create a new tag
            mx.data.create({
                entity: this._tagEntity,
                callback: lang.hitch(this, function(obj) {
                    //set the value
                    obj.set(this._tagAttribute, value);
                    //save
                    mx.data.commit({
                        mxobj: obj,
                        callback: lang.hitch(this, function() {
                            // save the label before calling the microflow to save the new label
                            this._contextObj.addReference(this._refAttribute, obj.getGuid());
                            this._saveObject();
                            //run the after create mf
                            if (this.aftercreatemf) {
                                this._execMf(this._contextObj, this.aftercreatemf);
                            } else {
                                console.log(this.id + " - please add an after create mf to commit the object, otherwise ui is incorrectly displayed.");
                            }
                        })
                    }, this);
                }),
                error: function(e) {
                    logger.error("Error creating object: " + e);
                }
            }, this);
        },

        _execMf: function(obj, mf, cb) {
            logger.debug(this.id + "._execMf : ", mf);
            if (obj && mf) {
                mx.data.action({
                    params: {
                        applyto: "selection",
                        actionname: mf,
                        guids: [obj.getGuid()],
                        origin: this.mxform
                    },
                    callback: function() {
                        if (cb && typeof cb === "function") {
                            cb();
                        }
                    },
                    error: function(e) {
                        logger.error("Error running Microflow: " + e);
                    }
                }, this);
            }
        },

        _resetSubscriptions: function() {
            logger.debug(this.id + "._resetSubscriptions");
            var handle = null,
                attrHandle = null,
                validationHandle = null;

            this._clearSubscriptions();

            if (this._contextObj) {
                handle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: function(guid) {
                        mx.data.get({
                            guid: guid,
                            callback: lang.hitch(this, function(obj) {
                                this._contextObj = obj;
                                this._fetchCurrentLabels();
                            })
                        });

                    }
                });
                attrHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    attr: this._refAttribute,
                    callback: lang.hitch(this, function(guid) {
                        mx.data.get({
                            guid: guid,
                            callback: lang.hitch(this, function(obj) {
                                this._contextObj = obj;
                                this._fetchCurrentLabels();
                            })
                        });
                    })
                });

                validationHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    val: true,
                    callback: lang.hitch(this, this._handleValidation)
                });

                this._handles.push(handle);
                this._handles.push(attrHandle);
                this._handles.push(validationHandle);
            }
        },

        _isReference: function(guid) {
            logger.debug(this.id + "._isReference");
            var isRef = false,
                refs = this._contextObj.getReferences(this._refAttribute);

            dojoArray.forEach(refs, function(ref, i) {
                if (ref === guid) {
                    isRef = true;
                }
            });

            return isRef;
        },

        _saveObject: function() {
            logger.debug(this.id + "._saveObject");
            var method = (!mx.version || mx.version && parseInt(mx.version.split(".")[0]) < 7) ? "save" : "commit";
            mx.data[method]({
                mxobj: this._contextObj,
                callback: lang.hitch(this, function() {
                    this._execMf(this._contextObj, this.onchangemf);
                })
            }, this);
        },

        _setOptions: function(tagArray) {
            logger.debug(this.id + "._setOptions");
            //TODO: allow users to set options
            var options = {
                availableTags: tagArray,
                autocomplete: {
                        delay: 0,
                        minLength: this.autocompleteMinLength
                    },
                enableCreate: this.enableCreate,
                showAutocompleteOnFocus: this.showAutoCompleteOnFocus,
                removeConfirmation: false,
                caseSensitive: this.caseSensitive,
                allowDuplicates: false,
                allowSpaces: this.allowSpaces,
                readOnly: this._readOnly,
                tagLimit: this.tagLimit > 0 ? this.tagLimit : null,
                singleField: false,
                singleFieldDelimiter: ",",
                singleFieldNode: null,
                tabIndex: null,
                placeholderText: null,

                afterTagAdded: lang.hitch(this, function(event, ui) {
                    this._clearValidations();
                    //fetch tag from cache
                    var tagObj = this._tagCache[ui.tagLabel];

                    if (tagObj) {
                        //check if already a reference
                        if (!this._isReference(tagObj.getGuid()) && !this._readOnly) {
                            this._contextObj.addReference(this._refAttribute, tagObj.getGuid());
                            this._saveObject();
                        }
                    } else if (this.enableCreate) {
                        this._createTagobject(ui.tagLabel);
                    } else if (this.removeMissing){
                        // Expects the tag-it function to be passed as duringInitialization property
                        if(ui.duringInitialization && ui.duringInitialization.removeTag){
                            ui.duringInitialization.removeTag(ui.tag);
                        }
                        logger.warn("No Tag found for value: " + ui.tagLabel);
                    } else if (this.missingValidationMsg && this.missingValidationMsg.trim().length > 0){
                        this._addValidation(this.missingValidationMsg.replace('${label}', ui.tagLabel));
                    } else {
                        logger.warn("No Tag found for value: " + ui.tagLabel);
                    }
                }),

                afterTagRemoved: lang.hitch(this, function(event, ui) {
                    this._clearValidations();
                    //fetch tag from cache
                    var tagObj = this._tagCache[ui.tagLabel];
                    if (tagObj) {
                        this._contextObj.removeReferences(this._refAttribute, [tagObj.getGuid()]);
                        this._saveObject();
                    } else {
                        // When both options are enabled, show the message after removing
                        if(this.removeMissing && this.missingValidationMsg && this.missingValidationMsg.trim().length > 0){ 
                            this._addValidation(this.missingValidationMsg.replace('${label}', ui.tagLabel));
                        }
                        logger.warn("No Tag found for value: " + ui.tagLabel);
                    }
                })
            };
            this._startTagger(options);
        },

        _handleValidation: function(validations) {
            logger.debug(this.id + "._handleValidation");
            this._clearValidations();

            var val = validations[0],
                msg = val.getReasonByAttribute(this._refAttribute);

            if (this.readOnly) {
                val.removeAttribute(this._refAttribute);
            } else {
                if (msg) {
                    this._addValidation(msg);
                    val.removeAttribute(this._refAttribute);
                }
            }
        },

        _clearValidations: function() {
            logger.debug(this.id + "._clearValidations");
            domConstruct.destroy(this._alertdiv);
        },

        _addValidation: function(msg) {
            logger.debug(this.id + "._addValidation");
            this._alertdiv = domConstruct.create("div", {
                "class": "alert alert-danger",
                innerHTML: msg
            });

            this.domNode.appendChild(this._alertdiv);
        },

        _clearSubscriptions: function() {
            logger.debug(this.id + "._clearSubscriptions");
            if (this._handles && this._handles.length && this._handles.length > 0) {
                dojoArray.forEach(this._handles, lang.hitch(this, function(handle) {
                    this.unsubscribe(handle);
                }));
                this._handles = [];
            }
        },

        uninitialize: function() {
            logger.debug(this.id + ".uninitialize");
            this._clearSubscriptions();
        },

        _executeCallback: function (cb, from) {
            logger.debug(this.id + "._executeCallback" + (from ? " from " + from : ""));
            if (cb && typeof cb === "function") {
                cb();
            }
        }
    });
});

require(["ConclusionLabelSelect/widget/ConclusionLabelSelect"]);
