function addConstantMarginToMap(marginToAdd, partyToShift)
{
  var partyToShift = partyToShift || selectedParty

  if (currentMapState != kEditing || partyToShift == null || partyToShift.getID() == TossupParty.getID()) { return }

  for (var regionID in displayRegionDataArray)
  {
    if (displayRegionDataArray[regionID].partyID != partyToShift.getID())
    {
      displayRegionDataArray[regionID].margin -= marginToAdd

      if (displayRegionDataArray[regionID].margin < 0)
      {
        displayRegionDataArray[regionID].margin *= -1
        displayRegionDataArray[regionID].partyID = partyToShift.getID()
      }
    }
    else
    {
      displayRegionDataArray[regionID].margin += marginToAdd
    }

    if (displayRegionDataArray[regionID].margin > 100)
    {
      displayRegionDataArray[regionID].margin = 100
    }
  }

  currentCustomMapSource.updateMapData(displayRegionDataArray, getCurrentDateOrToday(), false)
  loadDataMap()
}

function getTippingPointRegion()
{
  var partyTotals = getPartyTotals()
  partyTotals[TossupParty.getID()] = 0

  var greatestEVCount = Math.max.apply(null, Object.values(partyTotals))
  var majorityEVCount = Math.floor(currentMapType.getTotalEV()/2)+1

  if (Math.max.apply(null, Object.values(partyTotals)) < majorityEVCount) // If candidate with most EVs is less than 1/2 +1 of total, return 0
  {
    return 0
  }

  var winnerPartyID = getKeyByValue(partyTotals, greatestEVCount)
  var tippingPointRegion
  var checkedStates = []
  while (greatestEVCount >= majorityEVCount)
  {
    var nextClosestState = Object.values(displayRegionDataArray).reduce((min, state) => {
      return (state.margin < min.margin && state.partyID == winnerPartyID && !checkedStates.includes(state.region)) ? state : min
    })
    tippingPointRegion = nextClosestState
    greatestEVCount -= currentMapType.getEV(getCurrentDecade(), nextClosestState.region)
    checkedStates.push(nextClosestState.region)
  }

  return tippingPointRegion
}