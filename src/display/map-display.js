var currentMapType = mapTypes[mapTypeIDs[0]]

var mapSources = currentMapType.getMapSources()
var mapSourceIDs = currentMapType.getMapSourceIDs()
var currentCustomMapSource = currentMapType.getCustomMapSource()

var mapRegionNameToID = currentMapType.getRegionNameToID()

var currentMapSource = NullMapSource

var selectedParty

var defaultMarginValues = {safe: 15, likely: 5, lean: 1, tilt: Number.MIN_VALUE}
var marginValues = cloneObject(defaultMarginValues)
var marginNames = {safe: "Safe", likely: "Likely", lean: "Lean", tilt: "Tilt"}
var editMarginID = null

const defaultRegionFillColor = TossupParty.getMarginColors().safe
const regionFillAnimationDuration = 0.1
const regionStrokeAnimationDuration = 0.06

const regionSelectColor = "#ffffff"
const regionDeselectColor = "#181922" //#555

const regionDisabledColor = "#28292F"

const linkedRegions = [["MD", "MD-button"], ["DE", "DE-button"], ["NJ", "NJ-button"], ["CT", "CT-button"], ["RI", "RI-button"], ["MA", "MA-button"], ["VT", "VT-button"], ["NH", "NH-button"], ["HI", "HI-button"], ["ME-AL", "ME-AL-land"], ["ME-D1", "ME-D1-land"], ["ME-D2", "ME-D2-land"], ["NE-AL", "NE-AL-land"], ["NE-D1", "NE-D1-land"], ["NE-D2", "NE-D2-land"], ["NE-D3", "NE-D3-land"]]

var displayRegionDataArray = {}
var regionIDsToIgnore = [/.+-button/, /.+-land/]

var showingDataMap = false

var ignoreMapUpdateClickArray = []

var currentSliderDate
const initialKeyPressDelay = 500
const zoomKeyPressDelayForHalf = 3000
const maxDateSliderTicks = 55

const kEditing = 0
const kViewing = 1

var currentMapState = kViewing

var showingHelpBox = false

var showingCompareMap = false
var compareMapSourceIDArray = [null, null]
var compareMapDataArray = [null, null]
var selectedCompareSlider = null

var selectedDropdownDivID = null

$(async function() {
  currentMapType = mapTypes[getCookie("currentMapType") || mapTypeIDs[0]] || mapTypes[mapTypeIDs[0]]
  $("#cycleMapTypeButton").find("img").attr('src', currentMapType.getIconURL())

  reloadForNewMapType(true)

  preloadAssets([
    "assets/icon-download-none.png",
    "assets/icon-download.png",
    "assets/icon-loading.png",
    "assets/icon-download-complete.png",

    "assets/fivethirtyeight-large.png",
    "assets/jhk-large.png",
    "assets/cookpolitical-large.png",
    "assets/wikipedia-large.png",
    "assets/lte-large.png",
    "assets/pa-large.png"
  ])

  createMarginEditDropdownItems()
  createCountdownDropdownItems()
  createPartyDropdowns()

  addDivEventListeners()

  addTextBoxSpacingCSS()

  updateCountdownTimer()
  setTimeout(function() {
    setInterval(function() {
      updateCountdownTimer()
    }, 1000)
  }, 1000-((new Date()).getTime()%1000))

  $.ajaxSetup({cache: false})
})

async function reloadForNewMapType(initialLoad)
{
  var previousDateOverride
  if (initialLoad != true)
  {
    previousDateOverride = currentSliderDate ? currentSliderDate.getTime() : null
    clearMap(true, false)
  }

  mapSources = currentMapType.getMapSources()
  mapSourceIDs = currentMapType.getMapSourceIDs()
  currentCustomMapSource = currentMapType.getCustomMapSource()
  mapRegionNameToID = currentMapType.getRegionNameToID()

  if (currentMapType.getCustomMapEnabled())
  {
    $("#editDoneButton").removeClass('topnavdisable2')
    $("#compareButton").removeClass('topnavdisable2')
    $("#compareDropdownContent").removeClass('topnavdisable2')
    $("#compareDropdownContent").css("opacity", "100%")
  }
  else
  {
    $("#editDoneButton").addClass('topnavdisable2')
    $("#compareButton").addClass('topnavdisable2')
    $("#compareDropdownContent").addClass('topnavdisable2')
    $("#compareDropdownContent").css("opacity", "0%")
  }

  selectedParty = null
  displayRegionDataArray = {}
  regionIDsToIgnore = [/.+-button/, /.+-land/]
  showingDataMap = false
  ignoreMapUpdateClickArray = []
  currentSliderDate = null
  currentMapState = kViewing
  showingCompareMap = false
  compareMapSourceIDArray = [null, null]
  compareMapDataArray = [null, null]
  selectedCompareSlider = null

  createMapTypeDropdownItems()

  currentMapSource = currentMapType.getCurrentMapSourceID() ? mapSources[currentMapType.getCurrentMapSourceID()] : NullMapSource
  if (currentMapSource.getID() == NullMapSource.getID())
  {
    $("#sourceToggleButton").addClass('active')
  }

  await loadMapSVGFile()

  $("#totalsPieChartContainer").html("<canvas id='totalsPieChart'></canvas>")
  $("#helpbox").html(currentMapType.getControlsHelpHTML())

  $("#loader").hide()
  resizeElements(false)

  createMapSourceDropdownItems()
  createSettingsDropdownItems()
  createComparePresetDropdownItems()

  populateRegionsArray()
  for (var partyNum in selectablePoliticalPartyIDs)
  {
    if (selectablePoliticalPartyIDs[partyNum] == TossupParty.getID()) { continue }
    politicalParties[selectablePoliticalPartyIDs[partyNum]].setCandidateName(politicalParties[selectablePoliticalPartyIDs[partyNum]].getNames()[0])
  }
  displayPartyTotals(getPartyTotals())

  setupTotalsPieChart()
  updateTotalsPieChart()

  updateIconsBasedOnLocalCSVData()

  if (currentMapSource.getID() != NullMapSource.getID())
  {
    updateNavBarForNewSource()
    loadDataMap(false, false, previousDateOverride)
  }
  else
  {
    updateNavBarForNewSource(true)
  }
}

function loadMapSVGFile()
{
  var loadSVGFilePromise = new Promise((resolve, reject) => {
    $('#mapzoom').load(currentMapType.getSVGPath(), function() {
      setOutlineDivProperties()
      updateMapElectoralVoteText()
      resolve()
    })
  })

  return loadSVGFilePromise
}

function setOutlineDivProperties()
{
  $('#outlines').children().each(function() {
    var outlineDiv = $(this)

    outlineDiv.css('transition', "fill " + regionFillAnimationDuration + "s linear, stroke " + regionStrokeAnimationDuration + "s linear")
    outlineDiv.css('fill', defaultRegionFillColor)
    outlineDiv.css('cursor', "pointer")

    outlineDiv.attr('oncontextmenu', "rightClickRegion(this); return false;")
    outlineDiv.attr('onmouseenter', "mouseEnteredRegion(this)")
    outlineDiv.attr('onmouseleave', "mouseLeftRegion(this)")

    outlineDiv.bind('click', function(e) {
      if (e.altKey)
      {
        altClickRegion(e.target)
        return
      }
      else
      {
        leftClickRegion(this)
        return
      }
    })

    // outlineDiv.css('stroke', regionDeselectColor)
    // outlineDiv.css('stroke-width', 0.5)
  })
}

function resizeElements(initilizedPieChart)
{
  var windowWidth = $(window).width()

  //1.0*svgdatawidth*zoom/windowwidth == 0.6
  var mapZoom = 0.62*windowWidth/$("#svgdata").width()
  var topnavZoom = 0.85*mapZoom
  if (navigator.userAgent.indexOf("Firefox") != -1)
  {
    $("#mapzoom").css("transform", "scale(" + mapZoom + ")")
    $("#mapzoom").css("transform-origin", "0 0")
  }
  else
  {
    $("#mapzoom").css("zoom", (mapZoom*100) + "%")

    $(".topnav").css("zoom", (topnavZoom*100) + "%")
  }

  var mapWidth = $("#svgdata").width()*mapZoom
  var originalMapHeight = $("#svgdata").height()

  $(".slider").width(mapWidth-190)

  setSliderTickMarginShift("dataMapDateSliderContainer", "dataMapDateSlider", "dataMapSliderStepList")
  setSliderDateDisplayMarginShift("dateDisplay", "sliderDateDisplayContainer", "dataMapDateSlider", originalMapHeight, mapZoom)

  setSliderTickMarginShift("firstCompareSliderDateDisplayContainer", "firstCompareDataMapDateSlider", "firstCompareDataMapSliderStepList")
  setSliderDateDisplayMarginShift("firstCompareDateDisplay", "firstCompareSliderDateDisplayContainer", "firstCompareDataMapDateSlider", originalMapHeight, mapZoom)
  setSliderTickMarginShift("secondCompareSliderDateDisplayContainer", "secondCompareDataMapDateSlider", "secondCompareDataMapSliderStepList")
  setSliderDateDisplayMarginShift("secondCompareDateDisplay", "secondCompareSliderDateDisplayContainer", "secondCompareDataMapDateSlider", originalMapHeight, mapZoom)

  $("#totalsPieChart").width(windowWidth-windowWidth*0.12-mapWidth)
  $("#totalsPieChart").height(windowWidth-windowWidth*0.09-mapWidth)
  $("#totalsPieChart").css("background-size", $("#totalsPieChart").width()*totalsPieChartCutoutPercent/100.0*0.5)
  $("#totalsPieChart").css("background-position", "center")
  $("#totalsPieChart").css("background-repeat", "no-repeat")

  // const creditboxh3DefaultSize = 23
  // const creditboxh5DefaultSize = 17
  // const creditboxImageDefaultSize = 20

  // $("#creditbox h3").css('font-size', (creditboxh3DefaultSize*mapZoom/defaultMapZoom) + "px")
  // $("#creditbox h5").css('font-size', (creditboxh5DefaultSize*mapZoom/defaultMapZoom) + "px")
  // $("#creditbox img:not(.large-image)").css('width', (creditboxImageDefaultSize*mapZoom/defaultMapZoom) + "px")
  // $("#creditbox img:not(.large-image)").css('height', (creditboxImageDefaultSize*mapZoom/defaultMapZoom) + "px")

  const helpboxh3DefaultSize = 23
  const helpboxh5DefaultSize = 15

  const defaultMapZoom = 120.634/100

  $("#helpboxcontainer").css('min-width', $("#totalsPieChart").width())
  $("#partyDropdownsBoxContainer").css('min-width', $("#totalsPieChart").width())
  $("#partyDropdownsFlexbox").css('min-height', (110*mapZoom/defaultMapZoom))

  $("#discordInvite").css("width", $("#totalsPieChart").width())
  // $("#discordInvite").css("zoom", (mapZoom*100/defaultMapZoom) + "%")

  $("#helpbox h3").css('font-size', (helpboxh3DefaultSize*mapZoom/defaultMapZoom) + "px")
  $("#helpbox h5").css('font-size', (helpboxh5DefaultSize*mapZoom/defaultMapZoom) + "px")

  if (initilizedPieChart == true || initilizedPieChart == null)
  {
    updateTotalsPieChart()
  }
}

function setSliderTickMarginShift(sliderContainerDivID, sliderDivID, sliderTicksDivID)
{
  var shouldHideSlider = $("#" + sliderContainerDivID).is(":hidden")
  if (shouldHideSlider)
  {
    $("#" + sliderContainerDivID).show()
  }
  var marginShift = $("#" + sliderTicksDivID)[0].getBoundingClientRect().y-$("#" + sliderDivID)[0].getBoundingClientRect().y
  if (marginShift != 0)
  {
    $("#" + sliderTicksDivID).css("margin-top", "-" + marginShift + "px")
  }
  if (shouldHideSlider)
  {
    $("#" + sliderContainerDivID).hide()
  }
}

function setSliderDateDisplayMarginShift(dateDisplayDivID, sliderContainerDivID, sliderDivID, originalMapHeight, mapZoom)
{
  if (navigator.userAgent.indexOf("Firefox") != -1)
  {
    $("#" + dateDisplayDivID).css("transform", "scale(" + ($(window).width()*0.10/$("#" + dateDisplayDivID).width()) + ")")
    $("#" + dateDisplayDivID).css("transform-origin", "0 50%")
    $("#" + sliderContainerDivID).css("top", originalMapHeight*(mapZoom-1))
  }
  else
  {
    $("#" + dateDisplayDivID).css("zoom", (100*($(window).width()-1800)/6000+100) + "%")
  }

  $("#" + dateDisplayDivID).css("margin-top", ($("#" + sliderDivID).height()/4-1))
}

function preloadAssets(assetURLs)
{
  for (var urlNum in assetURLs)
  {
    (new Image()).src = assetURLs[urlNum]
  }
}

function addDivEventListeners()
{
  document.getElementById("clearMapButton").addEventListener('click', function(e) {
    clearMap()

    if (e.altKey)
    {
      for (var mapSourceID in mapSources)
      {
        mapSources[mapSourceID].resetMapData()
        removeStatusImage(mapSourceID.replace(/\s/g, '') + "-icon")
        insertStatusImage(mapSourceID.replace(/\s/g, '') + "-icon", "./assets/icon-download-none.png", 24, 24, -1)
      }
    }
  })

  document.getElementById("sourceToggleButton").addEventListener('click', function(e) {
    if (currentMapState == kEditing || editMarginID) { return }
    if (!e.altKey)
    {
      toggleMapSource(this)
    }
    else
    {
      downloadAllMapData()
    }
  })

  $("#uploadFileInput").change(function() {
    if (!this.files || this.files.length == 0) { return }
    loadUploadedFile(this.files[0])
  })

  document.getElementById("marginEditButton").addEventListener('click', function(e) {
    toggleMarginEditing()

    if (e.altKey)
    {
      marginValues = cloneObject(defaultMarginValues)
      createMarginEditDropdownItems()

      if (showingDataMap)
      {
        displayDataMap()
      }
    }
  })

  $("#stateboxcontainer").on('show', function() {
    $(this).show()
    $(this).css('opacity', "1")
  })

  $("#stateboxcontainer").on('hide', function() {
    $(this).css('opacity', "0")

    setTimeout(function() {
      if ($("#stateboxcontainer").css('opacity') == "0" && !currentRegionID) { $("#stateboxcontainer").hide() }
    }, 200)
  })
}

function addTextBoxSpacingCSS()
{
  var browserName = bowser.getParser(navigator.userAgent).getResult().browser.name

  switch (browserName)
  {
    case "Chrome":
    $(".textbox").css('letter-spacing', "1px")
    break

    case "Firefox":
    $(".textbox").css('letter-spacing', "0.8px")
    break
  }
}

function loadDataMap(shouldSetToMax, forceDownload, previousDateOverride)
{
  var loadDataMapPromise = new Promise(async (resolve, reject) => {
    $("#dataMapDateSliderContainer").hide()
    $("#dateDisplay").hide()

    if (selectedDropdownDivID != "mapSourcesDropdownContent")
    {
      $("#sourceToggleButton").removeClass('active')
    }

    currentMapType.setCurrentMapSourceID(currentMapSource.getID())

    var iconDivDictionary = getIconDivsToUpdateArrayForSourceID(currentMapSource.getID())
    var loadedSuccessfully = await downloadDataForMapSource(currentMapSource.getID(), iconDivDictionary, null, forceDownload)

    if (!loadedSuccessfully) { resolve(); return }

    shouldSetToMax = currentMapType.getMapSettingValue("startAtLatest") ? true : shouldSetToMax

    setDataMapDateSliderRange(shouldSetToMax, null, null, null, previousDateOverride)
    await displayDataMap()
    $("#dataMapDateSliderContainer").show()
    $("#dateDisplay").show()

    $("#totalsPieChart").attr('onclick', "currentMapSource.openHomepageLink(currentSliderDate)")

    if (currentMapSource.getIconURL() != null && currentMapSource.getIconURL() != "none")
    {
      $("#totalsPieChart").css("background-image", "url(" + currentMapSource.getIconURL() + ")")
    }
    else
    {
      $("#totalsPieChart").css("background-image", "")
    }

    resolve()
  })

  return loadDataMapPromise
}

function setDataMapDateSliderRange(shouldSetToMax, sliderDivID, sliderTickDivID, mapDates, previousDate)
{
  shouldSetToMax = shouldSetToMax == null ? false : shouldSetToMax
  sliderDivID = sliderDivID || "dataMapDateSlider"
  sliderTickDivID = sliderTickDivID || "dataMapSliderStepList"
  mapDates = mapDates || currentMapSource.getMapDates()
  previousDate = previousDate || (currentSliderDate ? currentSliderDate.getTime() : null)

  var startDate = new Date(mapDates[0])
  var endDate = new Date(mapDates[mapDates.length-1])

  var latestSliderTickEnabled = currentMapType.getMapSettingValue("latestTick")
  var previousValueWasLatest = $("#" + sliderDivID).val() != null && $("#" + sliderDivID).val() == $("#" + sliderDivID).attr('max') && latestSliderTickEnabled

  $("#" + sliderDivID).attr('max', mapDates.length+(latestSliderTickEnabled ? 1 : 0))

  if ((currentSliderDate == null && previousDate == null) || shouldSetToMax || previousValueWasLatest)
  {
    $("#" + sliderDivID).val(mapDates.length+(latestSliderTickEnabled ? 1 : 0))
    currentSliderDate = endDate
  }
  else
  {
    var closestDate = mapDates[0]
    var closestDateIndex = 0
    for (let dateNum in mapDates)
    {
      if (Math.abs(previousDate-mapDates[dateNum]) < Math.abs(closestDate-previousDate))
      {
        closestDate = mapDates[dateNum]
        closestDateIndex = dateNum
      }
    }

    $("#" + sliderDivID).val(parseInt(closestDateIndex)+1)
    currentSliderDate = new Date(closestDate)
  }

  $("#" + sliderTickDivID).empty()
  if (mapDates.length <= maxDateSliderTicks)
  {
    for (let dateNum in mapDates)
    {
      $("#" + sliderTickDivID).append("<span class='tick'></span>")
    }
    if (latestSliderTickEnabled)
    {
      $("#" + sliderTickDivID).append("<span class='tick'></span>")
    }
  }
}

function updateSliderDateDisplay(dateToDisplay, overrideDateString, sliderDateDisplayDivID)
{
  sliderDateDisplayDivID = sliderDateDisplayDivID || "dateDisplay"

  var dateString
  if (overrideDateString != null)
  {
    dateString = overrideDateString
  }
  else
  {
    dateString = (zeroPadding(dateToDisplay.getMonth()+1)) + "/" + zeroPadding(dateToDisplay.getDate()) + "/" + dateToDisplay.getFullYear()
  }

  $("#" + sliderDateDisplayDivID).html(dateString)
  currentSliderDate = dateToDisplay
}

async function displayDataMap(dateIndex)
{
  dateIndex = dateIndex || $("#dataMapDateSlider").val()

  var mapDates = currentMapSource.getMapDates()
  var dateToDisplay
  var overrideDateString
  if (dateIndex-1 > mapDates.length-1)
  {
    dateToDisplay = new Date(mapDates[dateIndex-1-1])
    overrideDateString = "Latest (" + (zeroPadding(dateToDisplay.getMonth()+1)) + "/" + zeroPadding(dateToDisplay.getDate()) + "/" + dateToDisplay.getFullYear() + ")"
  }
  else
  {
    dateToDisplay = new Date(mapDates[dateIndex-1])
  }

  updateSliderDateDisplay(dateToDisplay, overrideDateString)

  var shouldReloadSVG = false
  var currentSVGPath = currentMapType.getSVGPath()
  var newOverrideSVGPath = currentMapSource.getOverrideSVGPath(dateToDisplay)

  if (newOverrideSVGPath != null && currentSVGPath != newOverrideSVGPath)
  {
    currentMapType.setOverrideSVGPath(newOverrideSVGPath)
    shouldReloadSVG = true
  }
  else if (newOverrideSVGPath == null && currentSVGPath != null)
  {
    shouldReloadSVG = currentMapType.resetOverrideSVGPath()
  }

  if (shouldReloadSVG)
  {
    await loadMapSVGFile()
  }

  displayRegionDataArray = {}
  populateRegionsArray()

  $('#outlines').children().each(function() {
    var regionDataCallback = getRegionData($(this).attr('id'))
    var regionIDsToFill = regionDataCallback.linkedRegionIDs
    var regionData = regionDataCallback.regionData

    updateRegionFillColors(regionIDsToFill, regionData, false)
  })

  var currentMapDataForDate = currentMapSource.getMapData()[dateToDisplay.getTime()]

  for (var regionNum in currentMapDataForDate)
  {
    var regionDataCallback = getRegionData(currentMapDataForDate[regionNum].region)
    var regionData = regionDataCallback.regionData
    var regionsToFill = regionDataCallback.linkedRegionIDs

    if (regionData == null)
    {
      continue
    }

    regionData.region = currentMapDataForDate[regionNum].region
    regionData.margin = currentMapDataForDate[regionNum].margin
    regionData.partyID = currentMapDataForDate[regionNum].partyID
    regionData.disabled = currentMapDataForDate[regionNum].disabled
    regionData.candidateName = currentMapDataForDate[regionNum].candidateName
    regionData.candidateMap = currentMapDataForDate[regionNum].candidateMap
    regionData.chanceIncumbent = currentMapDataForDate[regionNum].chanceIncumbent
    regionData.chanceChallenger = currentMapDataForDate[regionNum].chanceChallenger
    regionData.partyVotesharePercentages = currentMapDataForDate[regionNum].partyVotesharePercentages
    regionData.seatClass = currentMapDataForDate[regionNum].seatClass

    updateRegionFillColors(regionsToFill, currentMapDataForDate[regionNum], false)
  }

  updatePoliticalPartyCandidateNames(dateToDisplay.getTime())
  displayPartyTotals(getPartyTotals())

  updateTotalsPieChart()

  updateMapElectoralVoteText()

  if (currentRegionID && currentMapState == kViewing)
  {
    updateStateBox(currentRegionID)
  }

  showingDataMap = true
}

function updateMapElectoralVoteText()
{
  if (!currentMapType.getShouldDisplayEVOnMap()) { return }

  var regionIDs = Object.values(mapRegionNameToID)
  for (var regionNum in regionIDs)
  {
    var regionChildren = $("#" + regionIDs[regionNum] + "-text").children()

    var regionEV = currentMapType.getEV(getCurrentDecade(), regionIDs[regionNum], (displayRegionDataArray[regionIDs[regionNum]] || {}).disabled, currentMapSource.getShouldSetDisabledWorthToZero())
    if (regionEV == undefined) { continue }

    if (regionChildren.length == 1)
    {
      regionChildren[0].innerHTML = regionIDs[regionNum] + " " + regionEV
    }
    else if (regionChildren.length == 2)
    {
      regionChildren[1].innerHTML = regionEV
    }
  }
}

function updateNavBarForNewSource(revertToDefault)
{
  revertToDefault = revertToDefault == null ? false : revertToDefault
  $("#mapSourcesDropdownContainer .active").removeClass("active")
  if (revertToDefault)
  {
    $("#sourceToggleButton").html("Select Source")
  }
  else
  {
    $("#sourceToggleButton").html("Source: " + currentMapSource.getName())
    $("#" + currentMapSource.getID().replace(/\s/g, '')).addClass("active")
  }

  if (currentMapState == kEditing && currentMapSource.getID() == currentCustomMapSource.getID())
  {
    $("#editDoneButton").html("Done")
  }
  else if (currentMapState == kEditing && currentMapSource.getID() != currentCustomMapSource.getID())
  {
    toggleEditing(kViewing)
  }
  else if (currentMapState != kEditing && currentMapSource.getID() == currentCustomMapSource.getID())
  {
    $("#editDoneButton").html("Edit")
  }
  else
  {
    $("#editDoneButton").html("Copy")
  }

  updatePartyDropdownVisibility()

  if (showingCompareMap && currentMapSource.getID() != currentCustomMapSource.getID())
  {
    updateCompareMapSlidersVisibility(false)
  }
  else if (showingCompareMap && currentMapSource.getID() == currentCustomMapSource.getID())
  {
    updateCompareMapSlidersVisibility(true)
  }
}

function clearMap(fullClear, shouldResetCurrentMapSource)
{
  fullClear = fullClear == null ? false : fullClear
  shouldResetCurrentMapSource = shouldResetCurrentMapSource != null ? shouldResetCurrentMapSource : true

  if (currentMapSource.getID() != currentCustomMapSource.getID() || currentCustomMapSource.getTextMapData().startsWith("date\n") || fullClear)
  {
    updateNavBarForNewSource(true)
    currentMapSource = NullMapSource
    if (shouldResetCurrentMapSource)
    {
      currentMapType.setCurrentMapSourceID(null)
    }

    toggleEditing(kViewing)

    currentSliderDate = null

    if (fullClear)
    {
      currentCustomMapSource.clearMapData(true)
    }
  }
  else
  {
    currentCustomMapSource.clearMapData()
    loadDataMap(false, true)
  }

  if (showingCompareMap)
  {
    showingCompareMap = false

    $(".comparesourcecheckbox").prop('checked', false)

    compareMapSourceIDArray = [null, null]
    updateCompareMapSlidersVisibility()

    $(".compareitemtext").html("&lt;Empty&gt;")
    $(".compareitemimage").css('display', "none")
    $(".compareitemimage").attr('src', "")

    toggleMapSettingDisable("seatArrangement", false)
  }

  marginValues = cloneObject(defaultMarginValues)
  createMarginEditDropdownItems()

  updatePoliticalPartyCandidateNames()
  updateMapElectoralVoteText()

  displayRegionDataArray = {}
  populateRegionsArray()

  for (var partyNum in selectablePoliticalPartyIDs)
  {
    if (selectablePoliticalPartyIDs[partyNum] == TossupParty.getID()) { continue }
    politicalParties[selectablePoliticalPartyIDs[partyNum]].setCandidateName(politicalParties[selectablePoliticalPartyIDs[partyNum]].getNames()[0])
  }

  $('#outlines').children().each(function() {
    var regionDataCallback = getRegionData($(this).attr('id'))
    var regionIDsToFill = regionDataCallback.linkedRegionIDs
    var regionData = regionDataCallback.regionData

    updateRegionFillColors(regionIDsToFill, regionData, false)
  })
  displayPartyTotals(getPartyTotals())

  updateTotalsPieChart()
  if (currentRegionID != null)
  {
    updateStateBox(currentRegionID)
  }

  $("#dataMapDateSliderContainer").hide()
  $("#dateDisplay").hide()

  $("#totalsPieChart").css("background-image", "")

  showingDataMap = false
}

function toggleHelpBox(helpButtonDiv)
{
  showingHelpBox = !showingHelpBox
  if (showingHelpBox)
  {
    $("#helpboxcontainer").show()
    $("#toggleHelpBoxButton").addClass('active')
    $("#totalsPieChartContainer").hide()
    $("#partyDropdownsBoxContainer").hide()
    $("#discordInviteContainer").hide()
  }
  else
  {
    $("#helpboxcontainer").hide()
    $("#toggleHelpBoxButton").removeClass('active')
    $("#totalsPieChartContainer").show()
    $("#partyDropdownsBoxContainer").show()
    $("#discordInviteContainer").show()
  }
}

function selectCreditBoxTab(buttonDiv, contentDiv)
{
  $(buttonDiv).parent().children().removeClass('active')
  $(buttonDiv).addClass('active')
  $("#creditbox .tabcontent").hide()
  $(contentDiv).show()
}

function populateRegionsArray()
{
  $('#outlines').children().each(function() {
    var regionID = $(this).attr('id')
    for (var regexNum in regionIDsToIgnore)
    {
      if (regionIDsToIgnore[regexNum].test(regionID))
      {
        return
      }
    }

    displayRegionDataArray[regionID] = {partyID: TossupParty.getID(), margin: 0}
  })
}

function toggleEditing(stateToSet)
{
  if (editMarginID) { return }

  if (stateToSet == null)
  {
    switch (currentMapState)
    {
      case kEditing:
      currentMapState = kViewing
      break

      case kViewing:
      currentMapState = kEditing
      break
    }
  }
  else
  {
    currentMapState = stateToSet
  }

  switch (currentMapState)
  {
    case kEditing:
    deselectAllParties()

    $("#editDoneButton").html("Done")
    $("#editDoneButton").addClass('active')

    $("#stateboxcontainer").trigger('hide')

    $("#marginEditButton").hide()
    $("#marginEditButton").addClass('topnavdisable')
    $("#marginsDropdownContainer").hide()

    $("#shiftButton").show()
    $("#shiftButton").removeClass('topnavdisable')
    $("#shiftDropdownContainer").show()

    $("#fillDropdownContainer").css('display', "block")

    var currentMapIsCustom = (currentMapSource.getID() == currentCustomMapSource.getID())
    currentCustomMapSource.updateMapData(displayRegionDataArray, getCurrentDateOrToday(), !currentMapIsCustom, currentMapSource.getCandidateNames(getCurrentDateOrToday()))

    if (!currentMapIsCustom)
    {
      currentCustomMapSource.setCandidateNames(currentMapSource.getCandidateNames((currentSliderDate || new Date(getCurrentDateOrToday())).getTime()))

      currentMapSource = currentCustomMapSource
      updatePoliticalPartyCandidateNames()
      updateNavBarForNewSource()
      loadDataMap()
    }
    break

    case kViewing:
    selectAllParties()

    if (currentMapSource.getID() == currentCustomMapSource.getID())
    {
      $("#editDoneButton").html("Edit")
    }
    else
    {
      $("#editDoneButton").html("Copy")
    }
    $("#editDoneButton").removeClass('active')

    $("#marginEditButton").show()
    $("#marginEditButton").removeClass('topnavdisable')
    $("#marginsDropdownContainer").show()

    $("#shiftButton").hide()
    $("#shiftButton").addClass('topnavdisable')
    $("#shiftDropdownContainer").hide()

    $("#fillDropdownContainer").css('display', "none")

    if (currentMapSource.getID() == currentCustomMapSource.getID())
    {
      currentCustomMapSource.updateMapData(displayRegionDataArray, getCurrentDateOrToday(), false)
    }

    if (showingDataMap && currentRegionID)
    {
      updateStateBox(currentRegionID)
    }
    break
  }

  updatePartyDropdownVisibility()
}

function leftClickRegion(div)
{
  if (currentMapState == kEditing)
  {
    if (ignoreNextClick)
    {
      ignoreNextClick = false
      return
    }

    var regionID = $(div).attr('id')
    if (regionIDsChanged.includes(regionID)) { return }

    var regionDataCallback = getRegionData(regionID)
    var regionData = regionDataCallback.regionData
    var regionIDsToFill = regionDataCallback.linkedRegionIDs

    if (regionData.disabled)
    {
      regionData.partyID = (selectedParty || TossupParty).getID()
      regionData.candidateName = regionData.candidateMap[regionData.partyID]
      regionData.margin = 101
    }
    else if (selectedParty != null && regionData.partyID != selectedParty.getID())
    {
      regionData.partyID = selectedParty.getID()
      regionData.candidateName = regionData.candidateMap[regionData.partyID]
      regionData.margin = marginValues.safe
    }
    else if (selectedParty != null)
    {
      var marginValueArray = Object.values(marginValues)
      var marginValueIndex = marginValueArray.indexOf(regionData.margin)
      if (marginValueIndex == -1)
      {
        for (var marginValueNum in marginValueArray)
        {
          if (regionData.margin >= marginValueArray[marginValueNum])
          {
            regionData.margin = marginValueArray[marginValueNum]
            break
          }
        }
        marginValueIndex = marginValueArray.indexOf(regionData.margin)
      }

      marginValueIndex += 1
      if (marginValueIndex > marginValueArray.length-1)
      {
        marginValueIndex = 0
      }

      // Hardcoding tilt = 0.1
      regionData.margin = marginValueIndex == marginValueArray.length-1 ? 0.1 : marginValueArray[marginValueIndex]
    }
    else
    {
      regionData.partyID = TossupParty.getID()
      regionData.margin = 0
    }

    updateRegionFillColors(regionIDsToFill, regionData)
    displayPartyTotals(getPartyTotals())
  }
  else if (currentMapState == kViewing && showingDataMap && currentRegionID)
  {
    currentMapSource.openRegionLink(currentRegionID, currentSliderDate)
  }
}

function rightClickRegion(div)
{
  if (currentMapState == kEditing)
  {
    var regionDataCallback = getRegionData($(div).attr('id'))
    var regionData = regionDataCallback.regionData
    var regionIDsToFill = regionDataCallback.linkedRegionIDs

    if (regionData.disabled)
    {
      regionData.partyID = (selectedParty || TossupParty).getID()
      regionData.candidateName = regionData.candidateMap[regionData.partyID]
      regionData.margin = 101
    }
    else if (selectedParty != null && regionData.partyID != selectedParty.getID())
    {
      regionData.partyID = selectedParty.getID()
      regionData.candidateName = regionData.candidateMap[regionData.partyID]
      regionData.margin = 0.1 // Hardcoding tilt == 0.1
    }
    else if (selectedParty != null)
    {
      var marginValueArray = Object.values(marginValues)
      var marginValueIndex = marginValueArray.indexOf(regionData.margin)
      if (marginValueIndex == -1)
      {
        for (var marginValueNum in marginValueArray)
        {
          if (regionData.margin >= marginValueArray[marginValueNum])
          {
            regionData.margin = marginValueArray[marginValueNum]
            break
          }
        }
        marginValueIndex = marginValueArray.indexOf(regionData.margin)
      }

      marginValueIndex -= 1
      if (marginValueIndex < 0)
      {
        marginValueIndex = marginValueArray.length-1
      }

      // Hardcoding tilt == 0.1
      regionData.margin = marginValueIndex == marginValueArray.length-1 ? 0.1 : marginValueArray[marginValueIndex]
    }
    else
    {
      regionData.partyID = TossupParty.getID()
      regionData.margin = 0
    }

    updateRegionFillColors(regionIDsToFill, regionData)
    displayPartyTotals(getPartyTotals())
  }
}

function altClickRegion(div)
{
  if (currentMapState == kEditing)
  {
    var regionDataCallback = getRegionData($(div).attr('id'))
    var regionData = regionDataCallback.regionData
    var regionIDsToFill = regionDataCallback.linkedRegionIDs

    regionData.partyID = (selectedParty || TossupParty).getID()

    if (regionData.disabled)
    {
      regionData.disabled = false
      regionData.margin = 100
    }
    else
    {
      regionData.disabled = true
      regionData.margin = 101
    }

    updateRegionFillColors(regionIDsToFill, regionData)
    displayPartyTotals(getPartyTotals())
  }
}

function getRegionData(regionID)
{
  var baseRegionIDCallback = getBaseRegionID(regionID)
  regionID = baseRegionIDCallback.baseID
  var linkedRegionIDs = baseRegionIDCallback.linkedIDs

  var regionData = displayRegionDataArray[regionID]

  return {regionData: regionData, linkedRegionIDs: linkedRegionIDs}
}

function getBaseRegionID(regionID)
{
  var linkedRegionIDs = [regionID]
  var foundRegion = regionID in displayRegionDataArray

  for (var linkedRegionSetNum in linkedRegions)
  {
    for (var linkedRegionIDNum in linkedRegions[linkedRegionSetNum])
    {
      if (linkedRegions[linkedRegionSetNum][linkedRegionIDNum] == regionID)
      {
        for (var linkedRegionIDNum2 in linkedRegions[linkedRegionSetNum])
        {
          var linkedRegionToTest = linkedRegions[linkedRegionSetNum][linkedRegionIDNum2]
          if (regionID != linkedRegionToTest)
          {
            linkedRegionIDs.push(linkedRegionToTest)
          }
          if (!foundRegion && linkedRegionToTest in displayRegionDataArray)
          {
            regionID = linkedRegionToTest
          }
        }
        return {baseID: regionID, linkedIDs: linkedRegionIDs}
      }
    }
  }

  return {baseID: regionID, linkedIDs: linkedRegionIDs}
}

function updateRegionFillColors(regionIDsToUpdate, regionData, shouldUpdatePieChart)
{
  var fillColor
  var shouldHide = false
  if (regionData.partyID == null || regionData.partyID == TossupParty.getID() || (regionData.disabled == true && currentMapType.getMapSettingValue("mapCurrentSeats") == false))
  {
    if (regionData.disabled == true)
    {
      fillColor = regionDisabledColor

      var regionsToHide = currentMapType.getRegionsToHideOnDisable()
      for (var regexNum in regionsToHide)
      {
        if (regionsToHide[regexNum].test(regionData.region))
        {
          shouldHide = true
          break
        }
      }
    }
    else
    {
      fillColor = TossupParty.getMarginColors().safe
    }
  }
  else
  {
    fillColor = politicalParties[regionData.partyID].getMarginColors()[getMarginIndexForValue(regionData.margin, regionData.partyID)]
  }

  for (var regionIDNum in regionIDsToUpdate)
  {
    var regionDiv = $("#" + regionIDsToUpdate[regionIDNum])
    regionDiv.css('animation-fill-mode', 'forwards')
    regionDiv.css('fill', fillColor)

    regionDiv.css('display', shouldHide ? 'none' : 'inherit')

    if (regionData.disabled == true && currentMapSource.getID() != currentCustomMapSource.getID())
    {
      regionDiv.css('pointer-events', 'none')
    }
    else
    {
      regionDiv.css('pointer-events', 'inherit')
    }
  }

  if (shouldUpdatePieChart == null || shouldUpdatePieChart == true)
  {
    updateTotalsPieChart()
  }
}

function getMarginIndexForValue(margin, partyID)
{
  if (margin == 101)
  {
    return "current"
  }
  for (var marginName in marginValues)
  {
    if (Math.abs(margin) >= marginValues[marginName])
    {
      return marginName
    }
  }
}

function getPartyTotals()
{
  var partyTotals = {}

  for (var partyIDNum in mainPoliticalPartyIDs)
  {
    partyTotals[mainPoliticalPartyIDs[partyIDNum]] = 0
  }

  for (var regionID in displayRegionDataArray)
  {
    var partyIDToSet = displayRegionDataArray[regionID].partyID
    if (displayRegionDataArray[regionID].partyID == null)
    {
      partyIDToSet = TossupParty.getID()
    }
    if (!(partyIDToSet in partyTotals))
    {
      partyTotals[partyIDToSet] = 0
    }
    partyTotals[partyIDToSet] += currentMapType.getEV(getCurrentDecade(), regionID, displayRegionDataArray[regionID].disabled, currentMapSource.getShouldSetDisabledWorthToZero())
  }

  return partyTotals
}

function getCurrentDecade()
{
  var dateForDecade
  if (currentMapSource.getID() == currentCustomMapSource.getID() && showingCompareMap)
  {
    var compareDate = mapSources[compareMapSourceIDArray[0]].getMapDates()[$("#firstCompareDataMapDateSlider")[0].value-1]
    if (compareDate != null)
    {
      dateForDecade = new Date(compareDate)
    }
  }
  else if (currentMapType.getID() == USAPresidentialMapType.getID() && currentMapType.getMapSettingValue("evDecadeOverrideToggle"))
  {
    return currentMapType.getMapSettingValue("evDecadeOverrideSelection")
  }
  else if (currentSliderDate != null)
  {
    dateForDecade = currentSliderDate
  }
  return Math.floor(((dateForDecade || new Date()).getFullYear()-1)/10)*10
}

function getCurrentDateOrToday()
{
  var dateToUse = new Date(getTodayString()).getTime()
  if (currentSliderDate)
  {
    dateToUse = currentSliderDate.getTime()
  }

  return dateToUse
}

function updateStateBox(regionID)
{
  var regionData = getRegionData(regionID).regionData
  if (regionID == null || regionData == null || regionData.partyID == null || regionData.partyID == TossupParty.getID() || regionData.disabled == true)
  {
    $("#stateboxcontainer").trigger('hide')
    return
  }
  $("#stateboxcontainer").trigger('show')

  var decimalPlaceToRound = Math.floor(-Math.log(regionData.margin)/Math.log(10)+2)
  if (decimalPlaceToRound <= 0)
  {
    decimalPlaceToRound = 1
  }

  var roundedMarginValue = decimalPadding(Math.round(regionData.margin*Math.pow(10, decimalPlaceToRound))/Math.pow(10, decimalPlaceToRound), currentMapSource.getAddDecimalPadding())
  var regionMarginString = (((currentMapSource.getID() == currentCustomMapSource.getID()) ? currentMapSource.getCandidateNames(currentSliderDate.getTime())[regionData.partyID] : regionData.candidateName) || politicalParties[regionData.partyID].getNames()[0]) + " +" + roundedMarginValue

  if (regionData.chanceChallenger && regionData.chanceIncumbent)
  {
    regionMarginString += "<br></span><span style='font-size: 17px; padding-top: 5px; padding-bottom: 5px; display: block; line-height: 100%;'>Chances<br>"
    regionMarginString += "<span style='color: " + politicalParties[incumbentChallengerPartyIDs.challenger].getMarginColors().lean + ";'>" // Hardcoding challenger first
    regionMarginString += decimalPadding(Math.round(regionData.chanceChallenger*1000)/10)
    regionMarginString += "%</span>&nbsp;&nbsp;&nbsp;<span style='color: " + politicalParties[incumbentChallengerPartyIDs.incumbent].getMarginColors().lean + ";'>"
    regionMarginString += decimalPadding(Math.round(regionData.chanceIncumbent*1000)/10)
    regionMarginString += "%</span></span>"
  }

  if (regionData.partyVotesharePercentages && currentMapSource.getShouldShowVoteshare() == true)
  {
    var sortedPercentages = regionData.partyVotesharePercentages.sort((voteData1, voteData2) => {
      return voteData2.voteshare - voteData1.voteshare
    })

    regionMarginString += "<br></span><span style='font-size: 17px; padding-top: 5px; padding-bottom: 0px; display: block; line-height: 100%;'>Voteshare<br></span>"

    regionMarginString += "<div style='font-size: 17px; padding-top: 2px; padding-bottom: 5px; display: block; line-height: 100%; border-radius: 50px;'>"

    sortedPercentages.forEach((voteData, i) => {
      regionMarginString += "<span id='voteshare-" + (voteData.partyID + "-" + voteData.candidate).hashCode() + "' style='display: inline-block; padding: 4px; color: #fff; border-radius: " + (i == 0 ? "3px 3px" : "0px 0px") + " " + (i == sortedPercentages.length-1 ? "3px 3px" : "0px 0px") + ";" + "'><span style='float: left;'>" + voteData.candidate + "</span><span style='float: right;'>"
      regionMarginString += decimalPadding(Math.round(voteData.voteshare*100)/100)
      regionMarginString += "%</span></span><br>"
    })

    regionMarginString += "</div>"
  }

  setTimeout(() => {
    if (sortedPercentages == null) { return }

    var largestWidth = $("#statebox").width()

    sortedPercentages.forEach(voteData => {
      var voteshareCandidateID = "#voteshare-" + (voteData.partyID + "-" + voteData.candidate).hashCode()

      $(voteshareCandidateID).css('background', "linear-gradient(90deg, " + politicalParties[voteData.partyID].getMarginColors().safe + " " + (parseFloat(voteData.voteshare)) + "%, " + politicalParties[voteData.partyID].getMarginColors().lean + " 0%)")
      $(voteshareCandidateID).css('width', largestWidth + "px")
    })
  }, 0)

  //Couldn't get safe colors to look good
  // + "<span style='color: " + politicalParties[regionData.partyID].getMarginColors()[getMarginIndexForValue(roundedMarginValue, regionData.partyID)] + "; -webkit-text-stroke-width: 0.5px; -webkit-text-stroke-color: white;'>"
  $("#statebox").html(getKeyByValue(mapRegionNameToID, currentRegionID) + "<br>" + "<span style='color: " + politicalParties[regionData.partyID].getMarginColors().lean + ";'>" + regionMarginString + "</span>")
}

async function addCompareMapSource(mapSourceID, clickDivIDToIgnore)
{
  if (clickDivIDToIgnore != null)
  {
    ignoreMapUpdateClickArray.push(clickDivIDToIgnore)
  }

  var checkboxID = mapSourceID.replace(/\s/g, '') + "-compare"
  var checkboxChecked = $("#" + checkboxID).prop('checked')

  var compareSourcesUpdated
  var mapSourceToUncheck
  if (checkboxChecked && compareMapSourceIDArray[0] == null && compareMapSourceIDArray[1] == null)
  {
    compareSourcesUpdated = [true, true]
    compareMapSourceIDArray[0] = mapSourceID
    compareMapSourceIDArray[1] = mapSourceID
  }
  else if (checkboxChecked && compareMapSourceIDArray[0] == compareMapSourceIDArray[1])
  {
    compareSourcesUpdated = [false, true]
    compareMapSourceIDArray[1] = mapSourceID
  }
  else if (checkboxChecked)
  {
    compareSourcesUpdated = [true, true]
    mapSourceToUncheck = shouldSwapCompareMapSources(compareMapSourceIDArray[0], compareMapSourceIDArray[1]) ? compareMapSourceIDArray[0] : compareMapSourceIDArray[1]
    compareMapSourceIDArray[0] = compareMapSourceIDArray[0] == mapSourceToUncheck ? mapSourceID : compareMapSourceIDArray[0]
    compareMapSourceIDArray[1] = compareMapSourceIDArray[1] == mapSourceToUncheck ? mapSourceID : compareMapSourceIDArray[1]
  }
  else if (!checkboxChecked && compareMapSourceIDArray[0] != compareMapSourceIDArray[1])
  {
    if (compareMapSourceIDArray[0] == mapSourceID)
    {
      compareSourcesUpdated = [true, false]
      compareMapSourceIDArray[0] = compareMapSourceIDArray[1]
    }
    else if (compareMapSourceIDArray[1] == mapSourceID)
    {
      compareSourcesUpdated = [false, true]
      compareMapSourceIDArray[1] = compareMapSourceIDArray[0]
    }
  }
  else if (!checkboxChecked && compareMapSourceIDArray[0] == compareMapSourceIDArray[1])
  {
    clearMap()
    return
  }

  if (mapSourceToUncheck)
  {
    $("#" + mapSourceToUncheck.replace(/\s/g, '') + "-compare").prop('checked', false)
  }

  await updateCompareMapSources(compareSourcesUpdated, false)

  showingCompareMap = true
  toggleMapSettingDisable("seatArrangement", true)
  updateCompareMapSlidersVisibility()
}

function updateCompareMapSources(compareSourcesToUpdate, overrideSwapSources, swapSliderValues)
{
  var updateCompareMapSourcesPromise = new Promise(async (resolve, reject) => {
    if (compareSourcesToUpdate[0])
    {
      let iconDivDictionary = getIconDivsToUpdateArrayForSourceID(compareMapSourceIDArray[0])
      $('.comparesourcecheckbox').prop('disabled', true)
      await downloadDataForMapSource(compareMapSourceIDArray[0], iconDivDictionary, null, false)
      $('.comparesourcecheckbox').prop('disabled', false)
    }
    if (compareSourcesToUpdate[1])
    {
      let iconDivDictionary = getIconDivsToUpdateArrayForSourceID(compareMapSourceIDArray[1])
      $('.comparesourcecheckbox').prop('disabled', true)
      await downloadDataForMapSource(compareMapSourceIDArray[1], iconDivDictionary, null, false)
      $('.comparesourcecheckbox').prop('disabled', false)
    }

    if (shouldSwapCompareMapSources(compareMapSourceIDArray[0], compareMapSourceIDArray[1]) && !overrideSwapSources)
    {
      swapCompareMapSources()
      compareSourcesToUpdate = [true, true]
    }

    var overrideDateValues = [null, null]
    if (swapSliderValues)
    {
      overrideDateValues[0] = $("#secondCompareDataMapDateSlider").val()
      overrideDateValues[1] = $("#firstCompareDataMapDateSlider").val()
    }

    var latestSliderTickEnabled = currentMapType.getMapSettingValue("latestTick")

    if (compareSourcesToUpdate[0])
    {
      setDataMapDateSliderRange(true, "firstCompareDataMapDateSlider", "firstCompareDataMapSliderStepList", mapSources[compareMapSourceIDArray[0]].getMapDates())
      $("#firstCompareDataMapDateSlider").val(overrideDateValues[0] || mapSources[compareMapSourceIDArray[0]].getMapDates().length+(latestSliderTickEnabled ? 1 : 0))
      setCompareSourceDate(0, overrideDateValues[0] || mapSources[compareMapSourceIDArray[0]].getMapDates().length+(latestSliderTickEnabled ? 1 : 0))
      $("#compareItemImage-0").css('display', "block")
      $("#compareItemImage-0").prop('src', mapSources[compareMapSourceIDArray[0]].getIconURL())
    }
    if (compareSourcesToUpdate[1])
    {
      setDataMapDateSliderRange(true, "secondCompareDataMapDateSlider", "secondCompareDataMapSliderStepList", mapSources[compareMapSourceIDArray[1]].getMapDates())
      $("#secondCompareDataMapDateSlider").val(overrideDateValues[1] || mapSources[compareMapSourceIDArray[1]].getMapDates().length+(latestSliderTickEnabled ? 1 : 0))
      setCompareSourceDate(1, overrideDateValues[1] || mapSources[compareMapSourceIDArray[1]].getMapDates().length+(latestSliderTickEnabled ? 1 : 0))
      $("#compareItemImage-1").css('display', "block")
      $("#compareItemImage-1").prop('src', mapSources[compareMapSourceIDArray[1]].getIconURL())
    }

    resolve()
  })

  return updateCompareMapSourcesPromise
}

function shouldSwapCompareMapSources(firstMapSourceID, secondMapSourceID)
{
  return mapSources[firstMapSourceID].getMapDates().slice(-1)[0] < mapSources[secondMapSourceID].getMapDates().slice(-1)[0]
}

function updateCompareMapSlidersVisibility(overrideShowHide)
{
  var showCompareSliders = overrideShowHide
  if (showCompareSliders == null)
  {
    showCompareSliders = showingCompareMap
  }

  if (showCompareSliders)
  {
    $("#firstCompareSliderDateDisplayContainer").show()
    $("#secondCompareSliderDateDisplayContainer").show()

    $("#sliderDateDisplayContainer").hide()
  }
  else
  {
    $("#firstCompareSliderDateDisplayContainer").hide()
    $("#secondCompareSliderDateDisplayContainer").hide()

    $("#sliderDateDisplayContainer").show()
  }

  if (showingCompareMap)
  {
    $("#compareButton").addClass('active')
    $("#compareArrayDropdownContainer").show()
    $("#comparePresetsDropdownContainer").hide()
  }
  else
  {
    $("#compareButton").removeClass('active')
    $("#comparePresetsDropdownContainer").show()
    $("#compareArrayDropdownContainer").hide()
  }
}

function setMapCompareItem(compareArrayIndex)
{
  if (!showingDataMap) { return }
  compareMapDataArray[compareArrayIndex] = cloneObject(displayRegionDataArray)
  $("#compareItem-" + compareArrayIndex).html(currentMapSource.getName() + " : " + getMDYDateString(currentSliderDate))
}

function setCompareSourceDate(compareArrayIndex, dateIndex)
{
  var mapDates = mapSources[compareMapSourceIDArray[compareArrayIndex]].getMapDates()

  var dateToDisplay
  var overrideDateString
  if (dateIndex-1 > mapDates.length-1)
  {
    dateToDisplay = new Date(mapDates[dateIndex-1-1])
    overrideDateString = "Latest (" + (zeroPadding(dateToDisplay.getMonth()+1)) + "/" + zeroPadding(dateToDisplay.getDate()) + "/" + dateToDisplay.getFullYear() + ")"
  }
  else
  {
    dateToDisplay = new Date(mapDates[dateIndex-1])
  }
  updateSliderDateDisplay(dateToDisplay, overrideDateString, compareArrayIndex == 0 ? "firstCompareDateDisplay" : "secondCompareDateDisplay")

  $("#compareItem-" + compareArrayIndex).html(mapSources[compareMapSourceIDArray[compareArrayIndex]].getName() + " (" + getMDYDateString(dateToDisplay) + ")")

  compareMapDataArray[compareArrayIndex] = mapSources[compareMapSourceIDArray[compareArrayIndex]].getMapData()[dateToDisplay.getTime()]

  if (compareArrayIndex == 0)
  {
    currentCustomMapSource.setCandidateNames(mapSources[compareMapSourceIDArray[compareArrayIndex]].getCandidateNames(dateToDisplay.getTime()))
  }

  applyCompareToCustomMap()
}

function applyCompareToCustomMap()
{
  if (compareMapDataArray.length < 2 || compareMapDataArray[0] == null || compareMapDataArray[1] == null) { return }

  var resultMapArray = {}
  for (var regionID in compareMapDataArray[0])
  {
    var compareRegionData0 = compareMapDataArray[0][regionID]
    var compareRegionData1 = compareMapDataArray[1][regionID]

    if (currentMapType.getMapSettings().seatArrangement == "election-type" && compareRegionData0.seatClass != compareRegionData1.seatClass)
    {
      if (regionID.endsWith("-S"))
      {
        compareRegionData1 = compareMapDataArray[1][regionID.replace("-S", "")]
      }
      else
      {
        compareRegionData1 = compareMapDataArray[1][regionID + "-S"]
      }
    }

    if (compareRegionData0.partyID == TossupParty.getID())
    {
      resultMapArray[regionID] = cloneObject(compareRegionData0)
    }
    else if (compareRegionData0.disabled == true || compareRegionData1.disabled == true)
    {
      resultMapArray[regionID] = cloneObject(compareRegionData0)
      resultMapArray[regionID].disabled = true
      resultMapArray[regionID].margin = 101
    }
    else
    {
      resultMapArray[regionID] = {}

      if (compareRegionData0.partyID == compareRegionData1.partyID)
      {
        resultMapArray[regionID].margin = compareRegionData0.margin-compareRegionData1.margin
      }
      else
      {
        resultMapArray[regionID].margin = compareRegionData0.margin+compareRegionData1.margin
      }

      if (resultMapArray[regionID].margin < 0)
      {
        var sortedVoteshareArray = compareRegionData0.partyVotesharePercentages.sort((cand1, cand2) => cand2.voteshare - cand1.voteshare)
        resultMapArray[regionID].partyID = sortedVoteshareArray[1].partyID
        resultMapArray[regionID].margin = Math.abs(resultMapArray[regionID].margin)
      }
      else
      {
        resultMapArray[regionID].partyID = compareRegionData0.partyID
      }

      if (compareRegionData0.seatClass)
      {
        resultMapArray[regionID].seatClass = compareRegionData0.seatClass
      }
    }
  }

  currentCustomMapSource.updateMapData(resultMapArray, (new Date(getTodayString())).getTime(), true)
  currentMapSource = currentCustomMapSource
  updateNavBarForNewSource()
  loadDataMap()
}