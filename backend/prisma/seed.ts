import * as bcrypt from 'bcrypt';
import {
  ChargerStatus,
  ChargerType,
  ConnectorType,
  Prisma,
  PrismaClient,
  UserRole,
} from '@prisma/client';

const prisma = new PrismaClient();

function decimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

async function main(): Promise<void> {
  const demoPasswordHash = await bcrypt.hash('Demo123!', 10);

  await prisma.chargingSession.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.issueReport.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.charger.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.station.deleteMany();
  await prisma.user.deleteMany();

  const demoDriver = await prisma.user.create({
    data: {
      name: 'Demo EV Driver',
      email: 'driver.demo@evcharging.local',
      passwordHash: demoPasswordHash,
      role: UserRole.EV_DRIVER,
      demoWalletBalance: decimal('650'),
    },
  });

  await prisma.user.create({
    data: {
      name: 'Demo Operator',
      email: 'operator.demo@evcharging.local',
      passwordHash: demoPasswordHash,
      role: UserRole.OPERATOR,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Demo Admin',
      email: 'admin.demo@evcharging.local',
      passwordHash: demoPasswordHash,
      role: UserRole.ADMIN,
    },
  });

  await prisma.vehicle.create({
    data: {
      userId: demoDriver.id,
      brand: 'Tesla',
      model: 'Model 3',
      batteryCapacityKWh: decimal('75'),
      connectorType: ConnectorType.CCS,
      maxSupportedPowerKW: decimal('50'),
      plateNumber: '35 DEMO 001',
    },
  });

  await prisma.station.create({
    data: {
      name: 'Karsiyaka Hub',
      address: 'Bostanli Mah. Cemal Gursel Cad. Karsiyaka, Izmir',
      latitude: decimal('38.457491'),
      longitude: decimal('27.112394'),
      operatingHours: '08:00-23:00',
      chargers: {
        create: [
          {
            label: 'DC 50kW #03',
            chargerType: ChargerType.DC,
            connectorType: ConnectorType.CCS,
            powerOutputKW: decimal('50'),
            pricePerKWh: decimal('4'),
            status: ChargerStatus.AVAILABLE,
          },
          {
            label: 'AC 22kW',
            chargerType: ChargerType.AC,
            connectorType: ConnectorType.TYPE2,
            powerOutputKW: decimal('22'),
            pricePerKWh: decimal('3'),
            status: ChargerStatus.AVAILABLE,
          },
        ],
      },
    },
  });

  await prisma.station.create({
    data: {
      name: 'Bornova Station',
      address: 'Kazim Dirik Mah. Universite Cad. Bornova, Izmir',
      latitude: decimal('38.469221'),
      longitude: decimal('27.219582'),
      operatingHours: '24/7',
      chargers: {
        create: [
          {
            label: 'DC 150kW',
            chargerType: ChargerType.DC,
            connectorType: ConnectorType.CCS,
            powerOutputKW: decimal('150'),
            pricePerKWh: decimal('5'),
            status: ChargerStatus.OCCUPIED,
          },
        ],
      },
    },
  });

  await prisma.station.create({
    data: {
      name: 'Buca Point',
      address: 'Adatepe Mah. Menderes Cad. Buca, Izmir',
      latitude: decimal('38.382513'),
      longitude: decimal('27.173018'),
      operatingHours: '09:00-22:00',
      chargers: {
        create: [
          {
            label: 'DC 50kW',
            chargerType: ChargerType.DC,
            connectorType: ConnectorType.CHADEMO,
            powerOutputKW: decimal('50'),
            pricePerKWh: decimal('4'),
            status: ChargerStatus.OFFLINE,
          },
        ],
      },
    },
  });

  console.log('Prisma seed completed successfully.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed.', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
