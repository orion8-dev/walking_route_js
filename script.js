// オブジェクト
let map, origin, destination;
// 中心点の緯度経度（東京駅）
const lat = 35.669055759072684, lng = 139.75864681491296;

const toastTrigger = document.getElementById('liveToastBtn')
const toastLive = document.getElementById('liveToast')

if (toastTrigger) {
    const toastBootstrap = bootstrap.Toast.getOrCreateInstance(toastLive)
    toastTrigger.addEventListener('click', () => {
        toastBootstrap.show()
    })
}

// マーカーを表示する関数
function showMarker(origin, destination) {
    const markerArr = [origin, destination];
    const pinStyles = [ZDC.MARKER_COLOR_ID_RED_L, ZDC.MARKER_COLOR_ID_GREEN_L]; // 出発地点と目的地のマーカースタイル

    markerArr.forEach((location, index) => {
        // マーカーを作成して地図に追加
        const marker = new ZDC.Marker(
            new ZDC.LatLng(location.lat, location.lng), // マーカーの位置
            { styleId: pinStyles[index] }              // マーカースタイル
        );
        map.addWidget(marker); // マーカーを地図に追加
    });
}

// ルート情報（所要時間と距離）を表示する関数
function showRouteInfo(rawDuration, rawDistance, stepCount, calorieBurn) {
    const stepInfoArea = document.getElementById('steps');
    const caloriInfoArea = document.getElementById('caloriBurn');
    stepInfoArea.textContent = `${stepCount} 歩`;
    caloriInfoArea.textContent = `${calorieBurn} kcal`;
    convertTime(rawDuration);
    convertDtn(rawDistance);
}


// 所要時間を適切な形式で表示する関数
function convertTime(rawDuration) {
    const timeInfoArea = document.getElementById('time');
    if (timeInfoArea) {
        const hours = Math.floor(rawDuration / 3600);
        const minutes = Math.floor((rawDuration % 3600) / 60);

        if (hours === 0 && minutes > 0) {
            timeInfoArea.textContent = `${minutes} 分`;
        } else if (hours > 0 && minutes === 0) {
            timeInfoArea.textContent = `${hours} 時間`;
        } else if (hours > 0 && minutes > 0) {
            timeInfoArea.textContent = `${hours} 時間${minutes} 分`;
        } else {
            timeInfoArea.textContent = 'すぐに到着します';
        }
    } else {
        console.error("所要時間の表示エリアが見つかりません。");
    }
}

// 距離をキロメートル単位で表示する関数
function convertDtn(rawDistance) {
    const distInfoArea = document.getElementById('dist');
    if (rawDistance && distInfoArea) {
        const distanceInKm = (rawDistance / 1000).toFixed(1);
        distInfoArea.textContent = `${distanceInKm} km`;
    } else {
        console.error("距離の表示エリアが見つかりません。");
    }
}


function calculatePolylineBounds(polylineCoordinates) {
    if (!polylineCoordinates || polylineCoordinates.length === 0) {
        return null; // Handle empty or invalid polyline
    }

    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let minLng = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;

    // Iterate over each point in the polyline to determine bounds
    polylineCoordinates.forEach(point => {
        if (point.lat < minLat) minLat = point.lat;
        if (point.lat > maxLat) maxLat = point.lat;
        if (point.lng < minLng) minLng = point.lng;
        if (point.lng > maxLng) maxLng = point.lng;
    });

    // Construct ZDC.LatLng objects for southwest and northeast corners
    const southWest = new ZDC.LatLng(minLat, minLng);
    const northEast = new ZDC.LatLng(maxLat, maxLng);

    const bounds = new ZDC.LatLngBounds(southWest, northEast);

    return bounds;
}

// ルート検索を実行する関数
function performRouteSearch(origin, destination) {
    const startPoint = `${origin.lng},${origin.lat}`;
    const goalPoint = `${destination.lng},${destination.lat}`;
    const api = "/route/route_mbn/walk";
    const params = {
        search_type: 4,
        from: startPoint,
        to: goalPoint,
        calorie: true,
        step_count: true,
    };

    try {
        map.requestAPI(api, params, function (response) {
            if (response.ret && response.ret.status === 'OK') {
                const route = response.ret.message.result.item[0].route;
                const rawDistance = route.distance;
                const rawDuration = route.time;
                const stepCount = route.step_count;
                const calorieBurn = route.calorie;
                showRouteInfo(rawDuration, rawDistance, stepCount, calorieBurn);

                let allCoordinates = [];
                // Process each section and link
                route.section.forEach(section => {
                    section.link.forEach(link => {
                        // Check if link has roof structure (structure_type 1)
                        const hasRoof = link.structure_type && link.structure_type.includes(1);
                        const color = hasRoof ? '#00dc00' : '#ff0000'; // Green or Red

                        // Convert GeoJSON [lng, lat] to LatLng objects
                        const linkCoords = link.line.coordinates.map(coord =>
                            new ZDC.LatLng(coord[1], coord[0])
                        );

                        // Collect all coordinates for bounds calculation
                        allCoordinates = allCoordinates.concat(linkCoords);

                        // Create polyline segment for this link
                        const polyline = new ZDC.Polyline(linkCoords, {
                            color: color,
                            width: 6,
                            pattern: 'solid',
                            opacity: 1
                        });
                        map.addWidget(polyline);
                    });
                });

                // Adjust map view to show entire route
                const bounds = calculatePolylineBounds(allCoordinates);
                if (bounds) {
                    const adjustZoom = map.getAdjustZoom(allCoordinates, { fix: false });
                    map.setCenter(adjustZoom.center);
                    map.setZoom(adjustZoom.zoom - 0.3);
                }

                showMarker(origin, destination);
            } else {
                console.error("ルート検索失敗");
            }
        });
    } catch (error) {
        console.error("ルート検索中にエラーが発生しました:", error);
    }
}

// ZMALoaderを初期化
ZMALoader.setOnLoad(function (mapOptions, error) {
    if (error) {
        console.error(error);
        return;
    }
    mapOptions.mouseWheelReverseZoom = true;
    mapOptions.centerZoom = false;
    mapOptions.center = new ZDC.LatLng(lat, lng); // 中心点の緯度経度を設定
    mapOptions.rotatable = true;
    mapOptions.tiltable = true;
    mapOptions.zipsResolutionWmts = 'high';

    // 地図を生成
    map = new ZDC.Map(
        document.getElementById('ZMap'),
        mapOptions,
        function () {
            const origin = new ZDC.LatLng(35.681406, 139.767132); // 東京駅
            const destination = new ZDC.LatLng(35.66671917430511, 139.75830306946293); // 新橋駅

            performRouteSearch(origin, destination); // ルート検索を実行

        },
        function () {
            console.log("APIエラー");
        }
    );
});
