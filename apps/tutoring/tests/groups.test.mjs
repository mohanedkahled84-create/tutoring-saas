import test from "node:test";
import assert from "node:assert/strict";
import {
  GroupsService,
  FakeGroupsRepository,
} from "../dist/features/groups/index.js";

test("DEV-68: GroupsService - Assistant role strips financial fields", async () => {
  const repo = new FakeGroupsRepository();
  const service = new GroupsService(repo);

  const group = await repo.create("tenant-1", {
    name: "مجموعة الكيمياء",
    price: 180,
    billing_model: "fixed_rent",
    fixed_rent_amount: 1500,
  });

  // Assistant query strips pricing fields
  const assistantList = await service.listGroups("tenant-1", "assistant");
  assert.equal(assistantList.length, 1);
  assert.equal(assistantList[0].name, "مجموعة الكيمياء");
  assert.equal(assistantList[0].price, undefined);
  assert.equal(assistantList[0].billing_model, undefined);
  assert.equal(assistantList[0].fixed_rent_amount, undefined);

  // Owner/Admin retains financial fields
  const ownerList = await service.listGroups("tenant-1", "owner");
  assert.equal(ownerList[0].price, 180);
  assert.equal(ownerList[0].billing_model, "fixed_rent");
  assert.equal(ownerList[0].fixed_rent_amount, 1500);
});

test("DEV-68: GroupsService - Student enrollment and barcode students compilation", async () => {
  const repo = new FakeGroupsRepository();
  const service = new GroupsService(repo);

  const group = await service.createGroup("tenant-1", { name: "رياضيات متقدمة" });
  repo.students.push({
    id: "std-1",
    name: "ياسين أحمد",
    parent_phone: "01011112222",
    student_code: "1050",
  });

  await service.enrollStudent("tenant-1", group.id, "std-1");
  const barcodeData = await service.getBarcodeStudents(group.id);

  assert.equal(barcodeData.groupName, "رياضيات متقدمة");
  assert.equal(barcodeData.students.length, 1);
  assert.equal(barcodeData.students[0].name, "ياسين أحمد");
  assert.equal(barcodeData.students[0].student_code, "1050");

  // Remove student
  await service.removeStudent(group.id, "std-1");
  const afterRemove = await service.getGroup(group.id);
  assert.equal(afterRemove?.students.length, 0);
});
