const fs = require('fs');
const path = require('path');

function updateSyncFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Update interface
    content = content.replace(
        /remarks: string;/g,
        'remarks: string;\n    vehicle?: string;'
    );

    // Update getStoredCoachTrips mapping
    content = content.replace(
        /remarks: t\.remarks \|\| "",/g,
        `remarks: (() => {
            try {
                if (t.remarks && t.remarks.startsWith("{")) {
                    return JSON.parse(t.remarks).remarks || "";
                }
                return t.remarks || "";
            } catch (e) { return t.remarks || ""; }
        })(),
        vehicle: (() => {
            try {
                if (t.remarks && t.remarks.startsWith("{")) {
                    return JSON.parse(t.remarks).vehicle || "";
                }
                return "";
            } catch (e) { return ""; }
        })(),`
    );

    // Update saveAllCoachTrips
    content = content.replace(
        /remarks: t\.remarks,/g,
        'remarks: JSON.stringify({ remarks: t.remarks, vehicle: t.vehicle }),'
    );

    // Update saveCoachTrip
    content = content.replace(
        /remarks: trip\.remarks,/g,
        'remarks: JSON.stringify({ remarks: trip.remarks, vehicle: trip.vehicle }),'
    );

    // Update updateCoachTrip
    content = content.replace(
        /remarks: updatedItem\.remarks,/g,
        'remarks: JSON.stringify({ remarks: updatedItem.remarks, vehicle: updatedItem.vehicle }),'
    );

    fs.writeFileSync(filePath, content, 'utf-8');
}

function updatePageFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Update handleAddRow
    content = content.replace(
        /remarks: "",/g,
        'remarks: "",\n            vehicle: "",'
    );

    // Desktop Layout Replace
    const desktopRegex = /<div className="flex flex-col gap-1 flex-\[1\.5\] min-w-\[150px\]">[\s\S]*?<span className="text-\[10px\] font-bold text-zinc-400 uppercase tracking-wider px-1">내용<\/span>[\s\S]*?<input[\s\S]*?value={t\.remarks}[\s\S]*?onChange={\(e\) => handleUpdate\(t\.id, "remarks", e\.target\.value\)}[\s\S]*?\/>[\s\S]*?<\/div>/;

    const desktopReplacement = `<div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">차량</span>
                                <input
                                    type="text"
                                    placeholder="차량 입력"
                                    className="h-[34px] w-full px-3 bg-transparent dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
                                    value={t.vehicle || ""}
                                    onChange={(e) => handleUpdate(t.id, "vehicle", e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-1 flex-[1.5] min-w-[150px]">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">비고</span>
                                <input
                                    type="text"
                                    placeholder="비고 입력"
                                    className="h-[34px] w-full px-3 bg-transparent dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
                                    value={t.remarks || ""}
                                    onChange={(e) => handleUpdate(t.id, "remarks", e.target.value)}
                                />
                            </div>`;
    
    content = content.replace(desktopRegex, desktopReplacement);

    // Mobile Layout Replace
    const mobileRegex = /<div className="flex flex-col gap-1">[\s\S]*?<label className="text-\[10px\] font-bold text-zinc-400 uppercase tracking-wider">내용<\/label>[\s\S]*?<input[\s\S]*?value={t\.remarks}[\s\S]*?onChange={\(e\) => handleUpdate\(t\.id, "remarks", e\.target\.value\)}[\s\S]*?\/>[\s\S]*?<\/div>/;

    const mobileReplacement = `<div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">차량</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-transparent dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[13px]"
                                    value={t.vehicle || ""}
                                    onChange={(e) => handleUpdate(t.id, "vehicle", e.target.value)}
                                    placeholder="차량 입력"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">비고</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-transparent dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[13px]"
                                    value={t.remarks || ""}
                                    onChange={(e) => handleUpdate(t.id, "remarks", e.target.value)}
                                    placeholder="비고 입력"
                                />
                            </div>`;
                            
    content = content.replace(mobileRegex, mobileReplacement);

    fs.writeFileSync(filePath, content, 'utf-8');
}

updateSyncFile(path.join(__dirname, 'src/lib/coach-trip-sync.ts'));
updatePageFile(path.join(__dirname, 'src/app/(main)/admin/coach-trip-schedule/page.tsx'));
console.log("Refactored coach trip schedule");
