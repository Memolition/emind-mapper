function Point(x, y) {
  this.x = parseInt(x) || 0;
  this.y = parseInt(y) || 0;
  this.visible = false;

  return this;
}

function MindMapper(canvas) {
  //Setup canvas
  this.canvas = canvas;
  this.ctx = canvas.getContext("2d");
  //Initiate globals and defaults
  this.level = 0;
  this.ideas = Array();
  this.branches = Array();
  this.playground = {
    width: 2000,
    height: 2000,
    cursor: new Point()
  };
  this.grid = {
    points: Array(),
    size: 20,
    color: "#000"
  };
  this.viewport = {
    x: 0,
    y: 0,
    width: this.canvas.width,
    height: this.canvas.height
  };
  //Default viewport position: Center-Middle
  if (this.playground.width > this.canvas.width) {
    this.viewport.x = this.playground.width / 2 - this.canvas.width / 2;
  }
  if (this.playground.height > this.canvas.height) {
    this.viewport.y = this.playground.height / 2 - this.canvas.height / 2;
  }

  //Setup Grid
  for (var x = 0; x * this.grid.size < this.playground.width; x++) {
    this.grid.points[x] = Array();
    for (var y = 0; y * this.grid.size < this.playground.height; y++) {
      this.grid.points[x][y] = new Point(x*this.grid.size,
                                         y*this.grid.size);
      this.grid.points[x][y]['active'] = false;
    }
  }
  this.drawGrid();

  //Create a new IndexedDB Instance
  this.idb = indexedDB.open("mind_mapper");
  this.idb.onerror = function() {
    alert("Unable to use IndexedDB.");
  };

  //Setup default event callbacks
  this.events.click.push(function() {
    if (this.selection.type == "idea" && this.selection.element) {
      for (var i = 0; i < this.selection.element.ideas.length; i++)
        this.drawIdea(this.selection.element.ideas[i]);

      for (var i = 0; i < this.selection.element.branches.length; i++)
        this.drawBranch(this.selection.element.branches[i]);
    }
  });
  this.events.context.push(function() {
    console.log("Right click");
  });
  this.events.mouseDown.push(() => {
    if (this.selection.type === null) {
      this.panning.state = true;
      this.panning.start = new Point(this.cursor.position.x,
                                     this.cursor.position.y);
    }
  });
  this.events.mouseUp.push(() => {
    if (this.selection.type === null) this.panning.state = false;
  });
  this.events.mouseOut.push(() => {
    if (this.selection.type === null) this.panning.state = false;
  });
  //Panning
  this.events.mouseMove.push((e) => {
    if(this.panning.state) {
      this.viewport.x -= this.cursor.position.x - this.panning.start.x;
      this.viewport.y -= this.cursor.position.y - this.panning.start.y;
      this.panning.start = new Point(this.cursor.position.x,
                                     this.cursor.position.y);
      this.draw();
    } else {
      //Draw closest snapping point
      var snappingPoint = this.gridClosest();
      if(snappingPoint) {
        this.draw();
        var esnap = this.removeOffsetPoint(snappingPoint);
        this.ctx.strokeStyle = "#ccc";
        this.ctx.strokeRect(esnap.x - 5, esnap.y - 5, 10, 10);
      }
    }
  });
  //Update cursor
  this.events.mouseMove.push((e) => {
    var rect = this.canvas.getBoundingClientRect();
    this.cursor.position = new Point(e.clientX - rect.left,
                                     e.clientY - rect.top);
    this.playground.cursor = this.offsetPoint(this.cursor.position);
    this.cursor.grid = new Point(
      (this.playground.cursor.x / this.grid.size),
      (this.playground.cursor.y / this.grid.size)
    );
    this.cursorPosition(e.clientX - rect.left, e.clientY - rect.top);
  });

  //Add DOM event listeners
  $(document).on("contextmenu", e => {
    if (e.target == this.canvas) {
      e.preventDefault();
      return false;
    }
  });
  $(document).on("click", e => {
    if (e.target == this.canvas) {
      e.preventDefault();
      this.events.click.forEach(funct => {
        funct.call(this, e);
      });
    }
  });
  $(document).on("mousemove", e => {
    if (e.target == this.canvas) {
      e.preventDefault();
      this.events.mouseMove.forEach(funct => {
        funct.call(this, e);
      });
    }
  });
  $(document).on("mousedown", e => {
    if (e.target == this.canvas) {
      e.preventDefault();
      if (e.button == 0) {
        this.events.mouseDown.forEach(funct => {
          funct.call(this, e);
        });
      } else {
        this.events.context.forEach(funct => {
          funct.call(this, e);
        });
      }
    }
  });
  $(document).on("mouseup", e => {
    if (e.target == this.canvas) {
      e.preventDefault();
      this.events.mouseUp.forEach(funct => {
        funct.call(this, e);
      });
    }
  });
  $(document).on("mouseout", e => {
    if (e.target == this.canvas) {
      e.preventDefault();
      this.events.mouseOut.forEach(funct => {
        funct.call(this, e);
      });
    }
  });

  return this;
}

MindMapper.prototype = {
  distance: function(pointA, pointB) {
    if(pointA && pointB) {
      return parseInt(Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y));
    }
    return false;
  },
  offsetPoint: function(point) {
    var point = new Point(point.x, point.y);
    //Add viewport Offset
    point.x += this.viewport.x;
    point.y += this.viewport.y;

    return point;
  },
  removeOffsetPoint: function(point) {
    var point = new Point(point.x, point.y);
    //Add viewport Offset
    point.x -= this.viewport.x;
    point.y -= this.viewport.y;

    return point;
  },
  insideViewport: function(point) {
    point.visible = true;
    if (
      point.x < this.viewport.x ||
      point.x > this.viewport.width + this.viewport.x
    )
      point.visible = false;
    if (
      point.y < this.viewport.y ||
      point.y > this.viewport.height + this.viewport.y
    )
      point.visible = false;
    return point;
  },
  drawGrid: function() {
    this.ctx.fillStyle = this.grid.color;
    for (var x = 0; x < this.grid.points.length; x++) {
      for (var y = 0; y < this.grid.points[x].length; y++) {
        var gridPoint = this.grid.points[x][y];
        if (this.insideViewport(gridPoint).visible) {
          
          gridPoint = this.removeOffsetPoint(gridPoint);
          if(gridPoint.active) {
            this.ctx.fillRect(gridPoint.x - 2, gridPoint.y - 2, 4, 4);
          } else {
            this.ctx.fillRect(gridPoint.x, gridPoint.y, 1, 1);
          }
        }
      }
    }
  },
  gridClosest: function() {
    var distances = Array();
    var points = Array();

    for(var x = 0; x < 2; x++) {
      for(var y = 0; y < 2; y++) {
        var nowX = this.cursor.grid.x + x;
        var nowY = this.cursor.grid.y + y;
        var nowPoint = this.grid.points[nowX][nowY];
        if(nowPoint) {
          var distance = this.distance(nowPoint, this.playground.cursor);
          if(distance) {
            distances.push(distance);
            points.push(nowPoint);
          }
        }
      }
    }
    if(distances.length > 0) {
      return points[distances.indexOf(Math.min(...distances))];
    }
    return false;
  },
  panning: {
    state: 0,
    start: new Point()
  },
  events: {
    click: Array(),
    context: Array(),
    mouseDown: Array(),
    mouseUp: Array(),
    mouseOut: Array(),
    mouseMove: Array()
  },

  selection: {
    selectable: Array(),
    type: null,
    element: null,
    state: 0
  },
  addSelectable: function(element) {
    this.selection.selectable.push(element);
  },
  cursor: {
    position: new Point(0, 0),
    grid: new Point(0, 0)
  },
  setCursor: function(type) {
    if (type != undefined) {
      this.canvas.cursor = type || "default";
    } else {
      return this._type;
    }
  },
  cursorPosition: function(x, y) {
    for (var i = 0; this.selection.selectable.length > i; i++) {
      var idea = this.selection.selectable[i];
      var inside = true;
      if (idea.x > x) inside = false;
      if (idea.y > y) inside = false;
      if (idea.width + idea.x < x) inside = false;
      if (idea.height + idea.y < y) inside = false;
      if (inside) {
        if (!this.selection.type == "idea" || this.selection.element != idea) {
          this.selection.type = "idea";
          this.selection.element = idea;
          this.selection.state = 1;
        }
      } else {
        if (this.selection.type == "idea" && this.selection.element == idea) {
          this.selection.type = null;
          this.selection.element = null;
          this.selection.state = 1;
        }
      }
    }
    if (this.selection.state == 1) {
      if (this.selection.type == "idea") this.canvas.style.cursor = "pointer";
      else this.canvas.style.cursor = "default";
    }
  },

  //Element factory
  createBranch: function(i1, i2, startSide, endSide) {
    var branch = {
      display: true,
      start: {},
      end: {},
      weight: 5,
      color: "#000", //"#050",
      middle: {
        start: {
          x: (i1.width + i1.style.padding / 2) / 2 + i1.x,
          y: (i1.height + i1.style.padding / 2) / 2 + i1.y
        },
        end: {
          x: (i2.width + i2.style.padding / 2) / 2 + i2.x,
          y: (i2.height + i2.style.padding / 2) / 2 + i2.y
        }
      }
    };

    if (startSide) {
      branch.start.side = startSide;
    } else {
      var vertical = 0;
      var horizontal = 0;

      horizontal = branch.middle.start.x - branch.middle.end.x;
      vertical = branch.middle.start.y - branch.middle.end.y;

      if (
        (horizontal < 0 ? horizontal * -1 : horizontal) >
        (vertical < 0 ? vertical * -1 : vertical)
      ) {
        branch.start.side = horizontal > 0 ? "left" : "right";
      } else {
        branch.start.side = vertical < 0 ? "bottom" : "top";
      }
    }
    /*
    else {
      branch.start.side = i1.side;
    }
    */
    if (endSide) {
      branch.end.side = endSide;
    } else {
      var vertical = 0;
      var horizontal = 0;

      horizontal = branch.middle.start.x - branch.middle.end.x;
      vertical = branch.middle.start.y - branch.middle.end.y;

      if (
        (horizontal < 0 ? horizontal * -1 : horizontal) <
        (vertical < 0 ? vertical * -1 : vertical)
      ) {
        branch.end.side = horizontal < 0 ? "left" : "right";
      } else {
        branch.end.side = vertical > 0 ? "bottom" : "top";
      }
    }

    if (branch.start.side == "top") {
      (branch.start.x = (i1.width + i1.style.padding / 2) / 2 + i1.x),
        (branch.start.y = i1.y);
    } else if (branch.start.side == "bottom") {
      branch.start.x = (i1.width + i1.style.padding / 2) / 2 + i1.x;
      branch.start.y = i1.y + i1.height;
    } else if (branch.start.side == "right") {
      branch.start.x = i1.x + i1.width;
      branch.start.y = (i1.height + i1.style.padding / 2) / 2 + i1.y;
    } else {
      branch.start.x = i1.x;
      branch.start.y = (i1.height + i1.style.padding / 2) / 2 + i1.y;
    }

    if (branch.end.side == "top") {
      branch.end.x = (i2.width + i2.style.padding / 2) / 2 + i2.x;
      branch.end.y = i2.y;
    } else if (branch.end.side == "bottom") {
      branch.end.x = (i2.width + i2.style.padding / 2) / 2 + i2.x;
      branch.end.y = i2.height + i2.y;
    } else if (branch.end.side == "right") {
      branch.end.x = i2.x + i2.width;
      branch.end.y = (i2.height + i1.style.padding / 2) / 2 + i2.y;
    } else {
      branch.end.x = i2.x;
      branch.end.y = (i2.height + i1.style.padding / 2) / 2 + i2.y;
    }

    this.branches.push(branch);
  },
  createIdea: function(x, y, i, s) {
    var idea = {
      createIdea: this.createIdea,
      createBranch: this.createBranch,
      ideas: Array(),
      branches: Array(),
      level: this.level + 1,
      parent: this
    };
    idea.side = "top";
    idea.display = true;
    idea.style = s || {
      //Style
      padding: 20,
      radius: 15,
      shape: "square",
      font: {
        color: "#fff",
        size: "12pt",
        family: "sans-serif"
      },
      border: {
        weight: "1px",
        color: "#000"
      },
      fill: {
        color: "#050"
      }
    };
    idea.x = x || 0; //X Position
    idea.y = y || 0; //Y Position
    idea.text = i || "Title"; //Inner Text
    if (idea.text.length > 0) {
      var tmp_canvas = $("<canvas>").get(0);
      var tmp_ctx = tmp_canvas.getContext("2d");
      tmp_ctx.font = idea.style.font.size + " " + idea.style.font.family;
      idea.width =
        tmp_ctx.measureText(idea.text).width + idea.style.padding * 2;
      idea.height = parseInt(idea.style.font.size) + idea.style.padding;
    } else {
      idea.width = w || 40; //Width
      idea.height = h || 40; //Height
    }
    this.ideas.push(idea);
    if (this.level > 0) this.createBranch(idea.parent, idea);
  },

  //Draw functions
  drawIdea: function(i) {
    this.addSelectable(i);
    this.ctx.fillStyle = i.style.fill.color;
    this.ctx.strokeStyle = i.style.border.color;
    if (i.style.shape == "square") {
      var rad = 15;
      this.ctx.beginPath();
      this.ctx.moveTo(i.x + i.style.radius, i.y);
      this.ctx.lineTo(i.x + i.width - i.style.radius, i.y);
      this.ctx.quadraticCurveTo(
        i.x + i.width,
        i.y,
        i.x + i.width,
        i.y + i.style.radius
      );
      this.ctx.lineTo(i.x + i.width, i.y + i.height - i.style.radius);
      this.ctx.quadraticCurveTo(
        i.x + i.width,
        i.y + i.height,
        i.x + i.width - i.style.radius,
        i.y + i.height
      );
      this.ctx.lineTo(i.x + i.style.radius, i.y + i.height);
      this.ctx.quadraticCurveTo(
        i.x,
        i.y + i.height,
        i.x,
        i.y + i.height - i.style.radius
      );
      this.ctx.lineTo(i.x, i.y + i.style.radius);
      this.ctx.quadraticCurveTo(i.x, i.y, i.x + i.style.radius, i.y);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.font = i.style.font.size + " " + i.style.font.family;
      this.ctx.fillStyle = i.style.font.color;
      this.ctx.fillText(i.text, i.x + i.style.padding, i.y + i.style.padding);
    }
  },
  drawBranch: function(b) {
    this.ctx.fillStyle = b.color;
    this.ctx.beginPath();
    this.ctx.moveTo(b.start.x, b.start.y);
    this.ctx.quadraticCurveTo(
      b.start.x + b.weight,
      b.end.y - b.weight,
      b.end.x,
      b.end.y
    );
    this.ctx.quadraticCurveTo(
      b.start.x - b.weight,
      b.end.y + b.weight,
      b.start.x,
      b.start.y
    );
    this.ctx.closePath();
    this.ctx.fill();
  },
  draw: function() {
    this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
    this.drawGrid();
    /*
    this.ideas.forEach(idea => {
      if (idea.display != false) {
        this.drawIdea(idea);
      }
    });
    this.branches.forEach(branch => {
      if (branch.display != false) {
        this.drawBranch(branch);
      }
    });
    */
  }
};
var mm = new MindMapper($("#map_wrapper").get(0));
mm.createIdea(200, 200, "Topic");
mm.ideas[0].createIdea(100, 100, "First");
mm.ideas[0].createIdea(200, 100, "Second");
mm.ideas[0].createIdea(100, 300, "Third");
mm.ideas[0].createIdea(200, 300, "Fourth");

mm.ideas[0].ideas[3].createIdea(275, 350, "First");
mm.ideas[0].ideas[3].createIdea(275, 400, "Second");
mm.ideas[0].ideas[3].createIdea(275, 450, "Third");
mm.ideas[0].ideas[3].createIdea(275, 500, "Fourth");
//mm.draw();