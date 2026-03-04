# Superpowers Install Component Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make superpowers a first-class installable component in cross-platform setup/update flows.

**Architecture:** Add dedicated superpowers lifecycle scripts (`install`, `update`, `doctor`) for bash and PowerShell, then wire them into `setup-all` and `update-all` component orchestration so fresh environments consistently get required superpowers dependencies.

**Tech Stack:** Bash, PowerShell, git clone/pull, filesystem links/junctions.

---

### Task 1: Superpowers lifecycle scripts

**Files:**
- Create: `scripts/install-superpowers.sh`
- Create: `scripts/update-superpowers.sh`
- Create: `scripts/doctor-superpowers.sh`
- Create: `scripts/install-superpowers.ps1`
- Create: `scripts/update-superpowers.ps1`
- Create: `scripts/doctor-superpowers.ps1`

### Task 2: Orchestrator integration

**Files:**
- Modify: `scripts/setup-all.sh`
- Modify: `scripts/setup-all.ps1`
- Modify: `scripts/update-all.sh`
- Modify: `scripts/update-all.ps1`
- Modify: `scripts/uninstall-all.sh`
- Modify: `scripts/uninstall-all.ps1`

### Task 3: Verification and docs updates

**Files:**
- Modify: `scripts/verify-aios.sh`
- Modify: `scripts/verify-aios.ps1`
- Modify: `README.md`
- Modify: `README-zh.md`

