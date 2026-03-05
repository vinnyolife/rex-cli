---
title: 개요
description: 기존 Codex/Claude/Gemini 워크플로를 OpenClaw 스타일 역량으로 강화하는 빠른 진입점.
---

# RexCLI 문서

> 지금 쓰는 CLI 습관은 그대로 유지하고, `codex` / `claude` / `gemini` 위에 OpenClaw 스타일 역량 레이어를 추가합니다.

[30초 시작 (Primary CTA)](getting-started.md){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="hero" data-rex-target="quick_start" }
[역량 사례 보기](case-library.md){ .md-button data-rex-track="cta_click" data-rex-location="hero" data-rex-target="case_library" }

프로젝트 URL: <https://github.com/rexleimo/rex-cli>

`RexCLI`는 다음 CLI를 위한 로컬 워크플로 레이어입니다.

- Codex CLI
- Claude Code
- Gemini CLI
- OpenCode

네이티브 CLI를 대체하지 않고, 아래 2가지를 추가합니다.

1. 파일시스템 ContextDB (세션 메모리)
2. 투명 래퍼 (`codex` / `claude` / `gemini` 그대로 사용)

## RexCLI가 제공하는 운영 역량

### 1. 랜딩 전환 경로 최적화 (노출 -> 클릭)

- 입력 조건: 현재 랜딩 URL, 타깃 사용자, 단일 핵심 행동(예: 빠른 시작).
- 핵심 동작: 메시지 이탈 구간 진단, CTA 집중, Hero/문제/증거/행동 블록 재작성.
- 표준 산출물: 즉시 반영 가능한 카피 블록, CTA 배치안, 이벤트 네이밍 시트.
- 검수 지표: 핵심 CTA 클릭률과 사례 페이지 유입률을 지속 개선 가능한 상태로 전환.

### 2. 역량 설명 재구성 (10초 내 이해 가능)

- 입력 조건: 서비스 범위, 대표 사례, 명확한 제외 범위.
- 핵심 동작: 추상적 설명을 "문제 -> 실행 -> 결과" 구조로 재정의.
- 표준 산출물: 역량 매트릭스, 대상 사용자 섹션, 우선순위 skills 목록.
- 검수 지표: 방문자가 10초 내 적합성을 판단하고 다음 단계로 이동.

### 3. ContextDB 기반 멀티 CLI 인수인계 안정화

- 입력 조건: Codex/Claude/Gemini 현재 사용 흐름과 끊김 지점.
- 핵심 동작: checkpoint 단위, 메모리 인계 규칙, one-shot/interactive 흐름 정의.
- 표준 산출물: 표준 인계 명령, 재시작 템플릿, 세션 간 운영 기준.
- 검수 지표: 도구 전환 시 배경 재설명 비용 감소.

### 4. 반복 운영의 skills 패키징 (경험의 표준화)

- 입력 조건: 주간 반복 업무, 현재 수동 프로세스, 품질 리스크.
- 핵심 동작: 단계 분해, 가드레일 추가, 검증 포인트 설계, skills 문서화.
- 표준 산출물: skill 문서, 실행 체크리스트, 완료 전 검증 게이트.
- 검수 지표: 온보딩 속도와 팀 산출물 품질의 일관성 향상.

## 고빈도 재사용 Skills

- `seo-geo-page-optimization`: 랜딩 구조, 카피, SEO/Geo 전환 최적화에 사용.
- `xhs-ops-methods`: 샤오홍슈 운영 워크플로 엔드투엔드 실행에 사용.
- `brainstorming`: 구현 전 목표/설계 방향 정렬에 사용.
- `writing-plans`: 다단계 요구사항의 실행 계획화에 사용.
- `dispatching-parallel-agents`: 독립 도메인의 안전한 병렬 실행에 사용.
- `systematic-debugging`: 증거 기반 디버깅에 사용.
- `verification-before-completion`: 완료 선언 전 필수 검증에 사용.

## 30초 시작 (먼저 실행)

```bash
git clone https://github.com/rexleimo/rex-cli.git
cd rex-cli
scripts/setup-all.sh --components all --mode opt-in
source ~/.zshrc
codex
```

## 빠른 실행

```bash
codex
claude
gemini
```

## 다음 읽기

- [빠른 시작](getting-started.md)
- [공식 사례 라이브러리](case-library.md)
- [블로그 사이트](https://cli.rexai.top/blog/ko/)
- [추천 링크](friends.md)
- [프로젝트(GitHub)](https://github.com/rexleimo/rex-cli)
- [변경 로그](changelog.md)
- [CLI 워크플로](use-cases.md)
- [아키텍처](architecture.md)
- [ContextDB](contextdb.md)
