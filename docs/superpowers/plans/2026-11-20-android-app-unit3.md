# 안드로이드 앱 3단계(마무리) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 폰 전체 EQ를 일상에서 손 안 가게: 고치면 자동 반영, "EQ로 들어보기"에서 바로 적용, 재부팅·시스템 종료 뒤 복원, 뒤로 가기 제스처, 2단계 리뷰에서 미룬 안정성, 시험 앱 정리.

**Spec:** `docs/superpowers/specs/2026-11-20-android-eq-app-design.md`(작업 단위 3번), 2단계 리뷰에서 미룬 항목(CLAUDE.md "다음 작업").

## Global Constraints
- 웹(배포 사이트) 동작은 그대로. 안드로이드 전용 부분은 `isAndroidApp()`/`getEqEngine().kind`로 가린다.
- 확인: `npx tsc -b`, `npm run lint`, `npm test`, `npm run build`, `npm run build:android`, CI 미리 보기 APK.

## Review Focus
- 자동 반영이 슬라이더를 끄는 동안 너무 자주 호출되지 않는지(0.3초 멈춘 뒤 한 번).
- 재부팅 복원이 "끈 상태"를 다시 켜지 않는지(SharedPreferences `on` = false면 아무것도 안 함).
- 뒤로 가기가 팝업이 없을 때 앱을 종료하지 않고 백그라운드로 보내는지(EQ 서비스는 계속).

---

### Task 1: 고치면 자동 반영 (`PhoneEqControl.tsx`)
- 이 EQ가 폰에 걸려 있고 값 서명이 달라지면 0.3초 멈춘 뒤 `applyPreset`을 자동으로 부른다. "변경 사항 적용" 버튼과 안내는 없앤다(실패하면 오류만 보여줌).

### Task 2: "EQ로 들어보기"에서 [폰에 적용] (`EqDialog.tsx`)
- 안드로이드 앱에서만 버튼. 아직 저장 안 했으면 EQ 목록에 저장한 뒤(이름 "기기 → 목표") `applyPreset(id, name, { filters, preamp })`. 결과를 한 줄로.

### Task 3: 서비스 복원·안정성 (`SystemEqService.java`, 새 `BootReceiver.java`, `SystemEqPlugin.java`, `AndroidManifest.xml`)
- `START_STICKY` + 인텐트 없이 다시 시작되면(시스템이 서비스를 죽였다 살림) SharedPreferences의 마지막 값으로 다시 건다. 꺼진 상태면 멈춘다.
- `BootReceiver`(`BOOT_COMPLETED`, `RECEIVE_BOOT_COMPLETED` 권한): 저장값이 켜짐이면 서비스를 시작해 복원.
- 세션 신호 방식의 효과는 최대 16개(넘으면 가장 오래된 것 해제).
- 알림 권한은 한 번만 묻기(SharedPreferences `askedNotification`).
- 플러그인 리스너는 자기 것일 때만 지우기.

### Task 4: 뒤로 가기 제스처 (`@capacitor/app`, `src/backButton.ts`, `main.tsx`)
- 열린 `<dialog>`가 있으면 맨 위 것을 닫고, 없으면 `App.minimizeApp()`(앱 종료 대신 백그라운드). 안드로이드 앱에서만 등록.

### Task 5: 설정 화면 문구, 시험 앱 정리, 문서
- 설정의 "저장 공간 영구 보존" 칸은 안드로이드 앱에서 숨김(앱 데이터는 브라우저처럼 지워지지 않음).
- `android-spike/`, `.github/workflows/android-spike.yml` 삭제. Releases `eq-spike`는 사용자가 GitHub에서 지우도록 안내(이 환경에서 릴리스 삭제 도구 없음).
- CLAUDE.md 갱신. 폰 확인: 자동 반영, 들어보기에서 적용, 재부팅 후 복원, 뒤로 가기, 알림 권한 거절 상태에서도 EQ, 화면 끈 채 30분 이상 유지(꺼지면 다음에 배터리 최적화 제외 추가).
