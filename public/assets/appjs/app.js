// Set up templates
var popoverTemplate         = _.template($("#popover-main").html());
var popoverItemTemplates    = {
  "text"     : _.template($("#popover-input").html()),
  "textarea" : _.template($("#popover-textarea").html()),
  "select"   : _.template($("#popover-select").html())
}
var tabnavTemplate         = _.template($("#tab-nav").html());
var tempTemplate           = _.template($("#temp-template").html());

var SnippetModel  = Backbone.Model.extend({
  getValues: function(){
    return _.reduce(this.get("fields"), function(obj, v){
      obj[v["name"]]  = v["value"];
      return obj;
    }, {})
  }
});

var SnippetView = Backbone.View.extend({
  tagName: "div"
  , className: "control-group"
  , initialize: function(){ 
    this.template = _.template($("#snippet-"+ mungText(this.model.get("title"))).html())
  }
  , render: function(){
    return this.$el.html(
      this.template(this.model.getValues())
    ).attr({                                                    
      "data-content"   : popoverTemplate({"items" : this.model.get("fields")})
      , "data-title"   : this.model.get("title")
      , "data-trigger" : "manual"
      , "data-html"    : true
    }).popover()
    this.delegateEvents();
  }
});

// Snippet Model / View
var TabSnippetView = SnippetView.extend({
  events:{
    "mousedown" : "mouseDownHandler"
  }
  , mouseDownHandler: function(mouseDownEvent){
    mouseDownEvent.preventDefault();
    //hide all popovers
    $(".popover").hide();
    $("body").append(new TempSnippetView({model: this.model.clone()}).render());
    $(".temp").css("background-color", "rgba(60,60,60,0.01)");
    pubsub.trigger("newTempPostRender", mouseDownEvent);
  }
});

var TempSnippetView = SnippetView.extend({
  initialize: function(){
    pubsub.on("newTempPostRender", this.postRender, this);
    this.constructor.__super__.initialize.call(this);
  }
  , render: function() {
    return this.$el.html(tempTemplate({text: this.constructor.__super__.render.call(this).html()}));
  }
  , postRender: function(mouseEvent){
    this._$temp = $(this.$el.find("form")[0]);
    this._$temp.css("-webkit-transform", "rotate(-2deg)");
    this.centerOnEvent(mouseEvent);
  }
  , className: "temp"
  , events:{
    "mousemove": "mouseMoveHandler",
    "mouseup" : "mouseUpHandler",
  }
  , centerOnEvent: function(mouseEvent){
    var mouseX = mouseEvent.pageX;
    var mouseY = mouseEvent.pageY;
    var $tempForm = $(this.$el.find("form")[0]);
    var halfHeight = $tempForm.height()/2;
    var halfWidth  = $tempForm.width()/2;
    $tempForm.css({
              "top"       : (mouseY - halfHeight) + "px",
              "left"      : (mouseX - halfWidth) + "px"
    });
    // Make sure the element has been drawn and 
    // has height in the dom before triggering.
    if (this._$temp.height() > 0) { 
      pubsub.trigger("tempMove", mouseEvent, this._$temp.height());
    }
  }
  , mouseMoveHandler: function(mouseEvent) {
    this.centerOnEvent(mouseEvent);
  }
  , mouseUpHandler: function(mouseEvent){
    pubsub.trigger("tempDrop", mouseEvent, this.model);
    this.remove();
  }
});

var MyFormSnippetView = SnippetView.extend({
  initialize: function(){
    this.constructor.__super__.initialize.call(this);
  }
  , events:{
    "mousedown" : "mouseDownHandler",
    "mouseup"   : "mouseUpHandler"
  }
  , mouseDownHandler : function(mouseDownEvent){
    var that = this;
    mouseDownEvent.preventDefault();
    $(".popover").hide();
    this.$el.popover("show");
    this.$el.on("mousemove", function(mouseMoveEvent){
      if(
        Math.abs(mouseDownEvent.pageX - mouseMoveEvent.pageX) > 10 || 
        Math.abs(mouseDownEvent.pageY - mouseMoveEvent.pageY) > 10
        ){
          $(".popover").hide();
          myForm.collection.remove(that.model);
          $("body").append(new TempSnippetView({model: that.model.clone()}).render());
          pubsub.trigger("newTempCreated", mouseDownEvent);
          that.mouseUpHandler();
        };
    });
  }
  , mouseUpHandler : function(mouseUpEvent) {
    this.$el.off("mousemove");
  }
});

//Snippet Collection
var SnippetsCollection = Backbone.Collection.extend({
  model: SnippetModel
  , renderAll: function(){
    return this.map(function(snippet){
      return new TabSnippetView({model: snippet}).render();
    });
  }
});

//User created form snippets
var MyFormSnippetsCollection = SnippetsCollection.extend({
  model: SnippetModel
  , renderAll: function(){
    return this.map(function(snippet){
      return new MyFormSnippetView({model: snippet}).render();
    });
  }
});

// My Form View
var MyForm = Backbone.View.extend({
  tagName: "fieldset"
  , initialize: function(){
    this.collection.on('add', this.render, this);
    this.collection.on('remove', this.render, this);
    this.collection.on('change', this.render, this);
    pubsub.on("tempMove", this.handleTempMove, this);
    pubsub.on("tempDrop", this.handleTempDrop, this);
    this.render();
  }
  , render: function(){
    //Render Snippet Views
    this.$el.empty();
    var that = this;
    _.each(this.collection.renderAll(), function(snippet){
      that.$el.append(snippet);
    });
    this.$el.appendTo("#build form");
    this.delegateEvents();
  }
  , getBottomAbove: function(eventY, height){
      var myFormBits = $(this.$el.find(".control-group"));
      var topelement = _.find(myFormBits, function(renderedSnippet) {
        if (($(renderedSnippet).position().top + $(renderedSnippet).height()) > eventY - height - 20) {
          return true;
        }
        else {
          return false;
      }
    });
    if (topelement){
    return topelement;
    } else {                                  
      return myFormBits[0];
    }
  }
  , handleTempMove: function(mouseEvent, height){
    $(".target").removeClass("target");
    if(mouseEvent.pageX >= $build.position().left && 
       mouseEvent.pageX < ($build.width() + $build.position().left) &&
       mouseEvent.pageY >= $build.position().top && 
       mouseEvent.pageY < ($build.height() + $build.position().top)){
      $(this.getBottomAbove(mouseEvent.pageY, height)).addClass("target");
    }
  }
  , handleTempDrop: function(mouseEvent, model){
    $(".target").removeClass("target");
    this.collection.add(model)
    console.log("Drop:" +mouseEvent.pageX + " - " + mouseEvent.pageY);
  }
})

// Tab Collection / View
var Tab = Backbone.View.extend({
  tagName: "div"
  , className: "tab-pane"
  , render: function(){
    //Render Snippet Views
    var that = this;
    _.each(this.collection.renderAll(), function(snippet){
      that.$el.append(snippet);
    });
    this.$el.attr("id", this.id)
    //render & append nav
    $(".nav.nav-tabs").append(tabnavTemplate({title: this._title, id: this.id}))
    //append tab pane
    this.$el.appendTo(".tab-content");
    this.delegateEvents();
  }
  // Set title text for nav.
  , setTitle: function(title){
    this._title = title;
    this.id     = mungText(title)
  }
});

var $build = $("#build");

// Convinience functions
var tabMaker = function(title, snippetCollection){
  var tab = new Tab({collection : snippetCollection})
  tab.setTitle(title);
  tab.render();
}

var mungText = function(str){
  return str.toLowerCase().replace(/\W/g,'')
}

//--- App Setup ---//

// Create Snippets

// Form Name

var pubsub = _.extend({}, Backbone.Events);

var formName = new SnippetModel({
  "title" : "Form Name"
  , "fields": [
    {"name": "name", "label" : "Form Name"  , "type" : "text" , "value" : "Form Name"}
  ]
});

//Text Input Snippets
var textInput = new SnippetModel({
  "title" : "Text Input"
  , "fields": [
      {"name" : "label"       ,"label"    : "Label Text"  , "type" : "text" , "value" : "label"}
    , {"name" : "prepend"     ,"label"    : "Prepend"     , "type" : "text" , "value" : "prepend"}
    , {"name" : "placeholder" ,"label"    : "Placeholder" , "type" : "text" , "value" : "placeholder"}
    , {"name" : "helptext"    ,"label"    : "Help Text"   , "type" : "text" , "value" : "help"}
  ]
});

// Bundle snippets for tabs
var textInputSnippets = new SnippetsCollection([
                                               textInput
]);
// Make tabs
tabMaker("Text Inputs", textInputSnippets)

//Make the first tab active!
$(".tab-pane").first().addClass("active");
$("ul.nav li").first().addClass("active");

//Set up form with title element.
var myFormCollection = new MyFormSnippetsCollection([formName]);
var myForm = new MyForm({ collection: myFormCollection, pubsub: pubsub })
