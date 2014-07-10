var ocargo = ocargo || {};

function createUi() {
    return new ocargo.SimpleUi();
}

function createDefaultLevel(nodeData, destination, decor, trafficLightData, ui, maxFuel, nextLevel, nextEpisode) {
    var nodes = createNodes(nodeData);
    var trafficLights = createAndAddTrafficLightsToNodes(nodes, trafficLightData);
    var destinationIndex = findByCoordinate(destination, nodes);
    var dest = destinationIndex > -1 ? nodes[destinationIndex] : nodes[nodes.length - 1];
    var map = new ocargo.Map(nodes, decor, trafficLights, dest, ui);
    var van = new ocargo.Van(nodes[0], nodes[0].connectedNodes[0], maxFuel, ui);
    return new ocargo.Level(map, van, ui, nextLevel, nextEpisode);
}

function createNodes(nodeData) {
    var nodes = [];

    var i;
    // Create nodes with coords
    for (i = 0; i < nodeData.length; i++) {
         var coordinate = new ocargo.Coordinate(
            nodeData[i]['coordinate'][0], nodeData[i]['coordinate'][1]);
         nodes.push(new ocargo.Node(coordinate));
    }

    // Link nodes (must be done in second loop so that linked nodes have definitely been created)
    for (i = 0; i < nodeData.length; i++) {
        var node = nodes[i];
        var connectedNodes = nodeData[i]['connectedNodes'];
        for (var j = 0; j < connectedNodes.length; j++) {
            node.addConnectedNode(nodes[connectedNodes[j]]);
        }
    }
    
    return nodes;
}

function createAndAddTrafficLightsToNodes(nodes, trafficLightData) {
	var trafficLights = [];
	for(i = 0; i < trafficLightData.length; i++){
    	var trafficLight = trafficLightData[i];
    	var controlledNodeId = trafficLight['node'];
    	var sourceNodeId = trafficLight['sourceNode'];
    	var redDuration = trafficLight['redDuration'];
    	var greenDuration = trafficLight['greenDuration'];
    	var startTime = trafficLight['startTime'];
    	var startingState = trafficLight['startingState'];
    	var controlledNode = nodes[controlledNodeId];
    	var sourceNode = nodes[sourceNodeId];
    	
    	var light = new ocargo.TrafficLight(startingState, startTime, redDuration, greenDuration, sourceNode, controlledNode);
    	trafficLights.push(light);
    	controlledNode.addTrafficLight(light);
    }
    return trafficLights;
}

function findByCoordinate(coordinate, nodes) {
    for (var i = 0; i < nodes.length; i++) {
        var coord = nodes[i].coordinate;
        if (coord.x === coordinate[0] && coord.y === coordinate[1]) {
            return i;
        }
    }
    return -1;
}

function initialiseDefault() {
    'use strict';

    var title = "Level " + LEVEL_ID;
    startPopup(title, "", LESSON + ocargo.messages.closebutton("Play"));

	ocargo.time = new ocargo.Time();
    ocargo.ui = createUi();
    ocargo.level = createDefaultLevel(PATH, DESTINATION, DECOR, TRAFFIC_LIGHTS, ocargo.ui, MAX_FUEL,
        NEXT_LEVEL, NEXT_EPISODE);
    ocargo.level.levelId = JSON.parse(LEVEL_ID);
    enableDirectControl();

    if ($.cookie("muted") === "true") {
        $('#mute').text("Unmute");
        ocargo.sound.mute();
    }
}

function enableDirectControl() {
    document.getElementById('moveForward').disabled = false;
    document.getElementById('turnLeft').disabled = false;
    document.getElementById('turnRight').disabled = false;
    document.getElementById('play').disabled = false;
    document.getElementById('controls').style.visibility='visible';
    document.getElementById('direct_drive').style.visibility='visible';
    document.getElementById('stop').style.visibility='hidden';
    document.getElementById('step').disabled = false;
}

function disableDirectControl() {
    document.getElementById('controls').style.visibility='hidden';
    document.getElementById('direct_drive').style.visibility='hidden';
    document.getElementById('stop').style.visibility='visible';
    document.getElementById('moveForward').disabled = true;
    document.getElementById('turnLeft').disabled = true;
    document.getElementById('turnRight').disabled = true;
    document.getElementById('play').disabled = true;
    document.getElementById('step').disabled = true;
}

function clearVanData() {
    var nodes = ocargo.level.map.nodes;
    var previousNode = nodes[0];
    var startNode = nodes[0].connectedNodes[0];
    ocargo.level.van = new ocargo.Van(previousNode, startNode, ocargo.level.van.maxFuel, ocargo.ui);
    ocargo.ui.setVanToFront(previousNode, startNode);
}

function trackDevelopment() {

    $('#moveForward').click(function() {
        disableDirectControl();
        ocargo.blocklyControl.addBlockToEndOfProgram('move_forwards');
        moveForward(enableDirectControl);
        ocargo.time.incrementTime();
    });

    $('#turnLeft').click(function() {
        disableDirectControl();
        ocargo.blocklyControl.addBlockToEndOfProgram('turn_left');
        moveLeft(enableDirectControl);
        ocargo.time.incrementTime();
    });

    $('#turnRight').click(function() {
        disableDirectControl();
        ocargo.blocklyControl.addBlockToEndOfProgram('turn_right');
        moveRight(enableDirectControl);
        ocargo.time.incrementTime();
    });

    $('#play').click(function() {
        if (ocargo.blocklyControl.incorrect) {
            ocargo.blocklyControl.incorrect.setColour(ocargo.blocklyControl.incorrectColour);
        }
        disableDirectControl();

        try {
            var program = ocargo.blocklyControl.populateProgram();
        } catch (error) {
            ocargo.level.fail('Your program crashed!<br>' + error);
            throw error;
        }

        program.instructionHandler = new InstructionHandler(ocargo.level, true);
        clearVanData();
        ocargo.time.resetTime();
        ocargo.level.play(program);
        ocargo.level.correct = 0;
    });

    $('#step').click(function() {
        if (ocargo.blocklyControl.incorrect) {
            ocargo.blocklyControl.incorrect.setColour(ocargo.blocklyControl.incorrectColour);
        }

        if (ocargo.level.program === undefined || ocargo.level.program.isTerminated) {
            try {
                ocargo.level.correct = 0;
                ocargo.level.program = ocargo.blocklyControl.populateProgram();
                ocargo.level.program.stepCallback = enableDirectControl;
                ocargo.level.stepper = stepper(ocargo.level, false);
                ocargo.level.program.startBlock.selectWithConnected();
                ocargo.level.program.instructionHandler = new InstructionHandler(ocargo.level, false);
                clearVanData();
                ocargo.time.resetTime();
                Blockly.addChangeListener(terminate);
            } catch (error) {
                ocargo.level.fail('Your program crashed!');
                throw error;
            }
        }
        disableDirectControl();
        $('#play > span').css('background-image', 'url(/static/game/image/arrowBtns_v3.svg)');
        ocargo.level.stepper();

        function terminate() {
            ocargo.level.program.isTerminated = true;
        }

    });
    
    $('#help').click(function() {
        startPopup('Help', HINT, ocargo.messages.closebutton("Close help"));
    });

    $('#clear').click(function() {
        ocargo.blocklyControl.reset();
        enableDirectControl();
        clearVanData();
        ocargo.time.resetTime();
        $('#play > span').css('background-image', 'url(/static/game/image/arrowBtns_v2.svg)');
    });

    $('#stop').click(function() {
        ocargo.level.program.terminate();
    });

    $('#slideBlockly').click(function() {
        var c = $('#programmingConsole');
        if (c.is(':visible')) {
            $('#paper').animate({width: '100%'});
            $('#sliderControls').animate({left: '0%'});
            $('#consoleSlider').animate({left: '0px'});
        } else {
            $('#paper').animate({width: '50%'});
            $('#programmingConsole').animate({ width: '50%'});
            $('#sliderControls').animate({left: '50%'})
            $('#consoleSlider').animate({left: '50%'});
        }
        c.animate({width: 'toggle'});
    });

    $('#consoleSlider').on('mousedown', function(e){
        var slider = $(this);
        var p = slider.parent().offset();

        //disable drag when mouse leaves this or the parent
        slider.on('mouseup', function(e){
            slider.off('mousemove');
            slider.parent().off('mousemove');
        });
        slider.parent().on('mouseup', function(e) {
            slider.off('mousemove');
            slider.parent().off('mousemove');
        });

        slider.parent().on('mousemove', function(me){
            var mx = me.pageX - p.left;
            var half = $( window ).width()/2;
            if (mx > half) {
                mx = half;
            }
            $('#consoleSlider').css({ left: mx });
            $('#paper').css({ width: ($( window ).width() - mx) });
            $('#programmingConsole').css({ width: mx });
            $('#sliderControls').css({ left: mx });

        });
    });

}

$(function() {
    initialiseDefault();
    trackDevelopment();
});

$('#mute').click(function() {
    var $this = $(this);
    if (ocargo.sound.volume === 0) {
        $this.text('Mute');
        ocargo.sound.unmute();
    } else {
        $this.text('Unmute');
        ocargo.sound.mute();
    }
});
