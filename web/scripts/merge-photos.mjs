// 병렬 수집 워커들이 생성한 item-photos-*.json을 main item-photos.json으로 안전하게 병합
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "../src");
const mainPhotoFile = path.join(srcDir, "item-photos.json");

const mainPhotos = fs.existsSync(mainPhotoFile)
  ? JSON.parse(fs.readFileSync(mainPhotoFile, "utf8"))
  : {};

const beforeCount = Object.keys(mainPhotos).length;
const files = fs.readdirSync(srcDir).filter((f) => /^item-photos-.+\.json$/.test(f));
let mergedCount = 0;

for (const f of files) {
  const p = path.join(srcDir, f);
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const [k, v] of Object.entries(data)) {
      if (!mainPhotos[k]) {
        mainPhotos[k] = v;
        mergedCount++;
      }
    }
    fs.unlinkSync(p); // 임시 파일 정리
  } catch (err) {
    console.error("Error merging", f, err.message);
  }
}

fs.writeFileSync(mainPhotoFile, JSON.stringify(mainPhotos, null, 2), "utf8");
console.log(`[merge-photos] 기존 ${beforeCount}장 + 신규 ${mergedCount}장 = 총 ${Object.keys(mainPhotos).length}장 저장 완료.`);
