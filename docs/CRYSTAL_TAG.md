# Crystal compute tag

Man and machine. UltraLife is the ingestion layer. The crystal stays the sensor.

## Where the tag comes from

The Resonance repo defines the device: a 25mm hexagonal crystal worn on a lapel. It senses, stores, computes, and couples to other crystals. The industrial module is RCM-1 in `ResonantCompute`. Eigen's Crystal Computer is a modal spin-phonon co-processor and is not a general-purpose computer. The tag is the identifier on a body or on a machine. It is not a claim that the crystal replaces the plant's control system.

## Two bearers

| Bearer | Where the tag sits | What KYC is |
|---|---|---|
| Person | Lapel | Biometric. Each pass logs the live waveform hash next to the enrolled waveform hash. `validators/biometric.ak` keeps the samples off the public datum. |
| Machine | Bolted to the asset | The crystal's own key and mount. A separator, a door, an access point, or any other machine. No body waveform. |

A separator is a machine tag. Each vessel carries its own. Doors and access points carry their own. An operator does not badge in on a shared password. Moving through the building is the lapel coupling to the door tag.

## Every interaction names both

`lib/ultralife/crystal_tag.ak` refuses a log unless the lapel id and the machine id are both present and different.

| Kind | Meaning |
|---|---|
| Enroll | Bind a lapel to a person, or bind a crystal to a separator, door, or machine. The person doing the mount is the lapel on that record. |
| Access | Lapel at a door or access point. |
| Operate | Lapel at a machine. A separator run is Operate against that separator's tag. |
| Check | An operator inspects a machine. Same pair of tags. The check is a record, not a side notebook. |

The on-chain record is `RecordSchema.TagEvent` in `validators/records.ak`.

- `subject` is the lapel tag.
- `asset` is the machine tag.
- `prev` is the lapel's enrolled waveform hash.
- `seal` is the operator's live waveform hash from this interaction.
- `commit` binds the kind, both tags, and the live waveform hash.
- The two waveform hashes must differ. A copy of the enrollment reading is a replay, the same rule as `validators/biometric.ak`.
- The samples are not a public field. The log an operator checks is the pair of hashes.

A tag cannot witness itself. A machine-only log, and a lapel with no machine, both fail.

## Ingestion

`log_interaction` on the node and on the service MCP builds the unsigned record. The wallet signs. The records validator checks that both tags are present. The biometric validator is the KYC gate for the lapel. Raw features stay on the crystal, which is the rule already written in `validators/biometric.ak`.

This does not deploy the script. The preprod reference scripts do not contain `TagEvent` yet. A wallet comes after that script is compiled and locked, which is the same gate as the rest of the plant spine.
