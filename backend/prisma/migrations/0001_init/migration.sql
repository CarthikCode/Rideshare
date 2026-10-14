-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."VehicleType" AS ENUM ('CAR', 'BIKE', 'AUTO', 'SHARED_CAB');

-- CreateEnum
CREATE TYPE "public"."RideStatus" AS ENUM ('ACTIVE', 'FULL', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."RequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ride" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "startLabel" TEXT NOT NULL,
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLng" DOUBLE PRECISION NOT NULL,
    "endLabel" TEXT NOT NULL,
    "endLat" DOUBLE PRECISION NOT NULL,
    "endLng" DOUBLE PRECISION NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "vehicleType" "public"."VehicleType" NOT NULL,
    "seatsTotal" INTEGER NOT NULL,
    "seatsAvailable" INTEGER NOT NULL,
    "note" TEXT,
    "status" "public"."RideStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JoinRequest" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "public"."RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "Ride_startLat_startLng_idx" ON "public"."Ride"("startLat", "startLng");

-- CreateIndex
CREATE INDEX "Ride_endLat_endLng_idx" ON "public"."Ride"("endLat", "endLng");

-- CreateIndex
CREATE INDEX "Ride_departureAt_idx" ON "public"."Ride"("departureAt");

-- CreateIndex
CREATE INDEX "JoinRequest_rideId_idx" ON "public"."JoinRequest"("rideId");

-- CreateIndex
CREATE INDEX "JoinRequest_requesterId_idx" ON "public"."JoinRequest"("requesterId");

-- CreateIndex
CREATE INDEX "Message_requestId_idx" ON "public"."Message"("requestId");

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "public"."Block"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "public"."Block"("blockerId", "blockedId");

-- AddForeignKey
ALTER TABLE "public"."Ride" ADD CONSTRAINT "Ride_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JoinRequest" ADD CONSTRAINT "JoinRequest_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "public"."Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JoinRequest" ADD CONSTRAINT "JoinRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."JoinRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

