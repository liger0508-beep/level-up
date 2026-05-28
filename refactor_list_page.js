const fs = require('fs');
const path = require('path');

function refactorListPage(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Remove the filter section
    const filterStart = content.indexOf('{/* ── CourseInfo Type Filters ── */}');
    const filterEnd = content.indexOf('{/* ── Recent CourseInfos (Top Carousel) ── */}');
    if (filterStart !== -1 && filterEnd !== -1) {
        content = content.slice(0, filterStart) + content.slice(filterEnd);
    }

    // Replace text: "최근 게시물" -> "최근 등록된 코스"
    content = content.replace(/최근 게시물/g, '최근 등록된 코스');
    
    // Replace text: "공지 일자" -> "작성 일자" (there may not be "공지 일자", but let's do it anyway)
    content = content.replace(/공지 일자/g, '작성 일자');

    // In the carousel, replace the badge section to show courseInput instead of Branch & Type
    const carouselBadgeRegex = /<div className="flex items-center justify-between mb-2">[\s\S]*?<h3 className="text-sm font-semibold/g;
    
    // Let's just use string replacement for the carousel rendering
    const customCarouselCode = `<div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-brand-navy text-white">
                                            골프장
                                        </span>
                                    </div>
                                </div>
                                <h3 className="text-sm font-semibold`;
    
    content = content.replace(carouselBadgeRegex, customCarouselCode);

    // Remove the border-l coloring from COURSE_INFO_TYPE_COLORS in the carousel
    // It's in className: COURSE_INFO_TYPE_COLORS[courseInfo.type]?.border || "border-l-brand-navy"
    content = content.replace(/COURSE_INFO_TYPE_COLORS\[courseInfo\.type\]\?\.border \|\| "border-l-brand-navy"/g, '"border-l-brand-navy"');

    // Remove unused import if present
    content = content.replace(/activeType === key/g, 'true');

    fs.writeFileSync(filePath, content, 'utf-8');
}

refactorListPage(path.join(__dirname, 'src/app/(main)/course-info/page.tsx'));
console.log("List page refactored.");
