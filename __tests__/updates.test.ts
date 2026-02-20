import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("تعديلات التطبيق الثمانية", () => {
  // 1. تبسيط حقول إضافة الدواء - حقل strips في schema
  it("يجب أن يحتوي جدول الأدوية على حقل strips", () => {
    const schema = fs.readFileSync(
      path.join(__dirname, "../drizzle/schema.ts"),
      "utf-8"
    );
    expect(schema).toContain('strips: int("strips")');
  });

  // 2. دعم صور الإعلانات بروابط خارجية
  it("يجب أن يدعم الإعلانات حقل imageUrl", () => {
    const schema = fs.readFileSync(
      path.join(__dirname, "../drizzle/schema.ts"),
      "utf-8"
    );
    // banners table should have imageUrl
    expect(schema).toContain("banners");
    expect(schema).toContain("imageUrl");
  });

  // 3. الخلفية الزرقاء تنتهي عند مربع البحث
  it("يجب أن تكون لوحة الإعلانات خارج الهيدر الأزرق", () => {
    const indexFile = fs.readFileSync(
      path.join(__dirname, "../app/(tabs)/index.tsx"),
      "utf-8"
    );
    // Banner section should be after the header closing tag
    const headerEnd = indexFile.indexOf("</View>", indexFile.indexOf("searchContainer"));
    const bannerStart = indexFile.indexOf("bannerSection");
    expect(bannerStart).toBeGreaterThan(headerEnd);
  });

  // 4. كيرف منحنى في الخلفية الزرقاء
  it("يجب أن يكون هناك borderBottomLeftRadius في الهيدر", () => {
    const indexFile = fs.readFileSync(
      path.join(__dirname, "../app/(tabs)/index.tsx"),
      "utf-8"
    );
    expect(indexFile).toContain("borderBottomLeftRadius");
    expect(indexFile).toContain("borderBottomRightRadius");
  });

  // 5. لون القلب أحمر في شريط التنقل
  it("يجب أن يكون لون أيقونة القلب أحمر", () => {
    const layoutFile = fs.readFileSync(
      path.join(__dirname, "../app/(tabs)/_layout.tsx"),
      "utf-8"
    );
    expect(layoutFile).toContain("#FF0000");
    expect(layoutFile).toContain("heart.fill");
  });

  // 6. حذف الأدوية فعلي من قاعدة البيانات
  it("يجب أن يكون حذف الأدوية فعلي (delete) وليس soft delete", () => {
    const dbFile = fs.readFileSync(
      path.join(__dirname, "../server/db.ts"),
      "utf-8"
    );
    // deleteMedicine should use db.delete not db.update
    const deleteFunc = dbFile.substring(
      dbFile.indexOf("async function deleteMedicine"),
      dbFile.indexOf("}", dbFile.indexOf("async function deleteMedicine") + 100) + 1
    );
    expect(deleteFunc).toContain("db.delete(medicines)");
    expect(deleteFunc).not.toContain("isActive: false");
  });

  // 7. الشاشة الرئيسية قابلة للتمرير بالكامل
  it("يجب أن تستخدم الصفحة الرئيسية ScrollView كحاوية رئيسية", () => {
    const indexFile = fs.readFileSync(
      path.join(__dirname, "../app/(tabs)/index.tsx"),
      "utf-8"
    );
    expect(indexFile).toContain("ScrollView");
    expect(indexFile).toContain("showsVerticalScrollIndicator={false}");
  });

  // 8. القسم العلوي في لوحة الإدارة مضغوط
  it("يجب أن يكون القسم العلوي في الإدارة مضغوطاً", () => {
    const adminFile = fs.readFileSync(
      path.join(__dirname, "../app/(tabs)/admin.tsx"),
      "utf-8"
    );
    expect(adminFile).toContain("headerCompact");
    expect(adminFile).toContain("tabsBarCompact");
    expect(adminFile).toContain("tabItemCompact");
  });

  // API يدعم حقل strips
  it("يجب أن يدعم API إنشاء الأدوية حقل strips", () => {
    const routersFile = fs.readFileSync(
      path.join(__dirname, "../server/routers.ts"),
      "utf-8"
    );
    expect(routersFile).toContain("strips: z.number().optional()");
  });

  // أيقونات التبويبات صحيحة
  it("يجب أن تكون أيقونات التبويبات صحيحة (سلة، شخص)", () => {
    const layoutFile = fs.readFileSync(
      path.join(__dirname, "../app/(tabs)/_layout.tsx"),
      "utf-8"
    );
    expect(layoutFile).toContain("cart.fill");
    expect(layoutFile).toContain("person.fill");
    expect(layoutFile).toContain("gearshape.fill");
  });
});
