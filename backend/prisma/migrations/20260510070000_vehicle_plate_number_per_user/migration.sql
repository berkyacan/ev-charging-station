DROP INDEX "Vehicle_plateNumber_key";

CREATE UNIQUE INDEX "Vehicle_userId_plateNumber_key" ON "Vehicle"("userId", "plateNumber");
