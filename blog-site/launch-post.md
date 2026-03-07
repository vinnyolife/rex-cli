# 드디어 등장! AI 프로그래밍 도구들의 "싸움"을 해결하는 RexCLI를 만들었습니다

솔직히 말하면, 전에 세 개의 AI 프로그래밍 도구로 인해 지옥을 보았다.

Claude Code는 코딩은強 لكن 브라우저 자동화 설정이 귀찮았다.
Codex 자동화는爽 하지만 복잡한 코드 리팩토링은 그저 그럼.
Gemini 자료 조사는 좋은데 일시키면 자꾸 뻑난다.

"왜 하나의 도구로全部 못 담지?" 계속 이상했다.

 그래서 내가 만들었다.

---

## 01. 어떤 문제에 마주쳤나?

### 상황1: 브라우저自动化

小红书 자동 게시물想让.

Claude Code 쓸까? 먼저 MCP 설정. 3시간 걸려漸烫 돌아감. 그런데 다음 날—계정이 风控됨.

Codex 쓸까? 박스에서 꺼내자마자 써 Pilgun. 근데途中でClaude에게 코드 최적화시키고 싶었으면—**컨텍스트全部 삭제** 처음부터.

### 상황2: 장타스크 중단

2000줄 이상 코드 리팩토링 작업 중. 회의 하고 와서 계속—

Claude: 어디까지 했지, 기억은 하는데细节 잊은.
Codex: 어디까지 했지, 리팩토링思路 빗나감.
Gemini: 나是谁, 어디야?

**그게 그때 일상: 도구 바꾸거나, 설정 다시 하거나.**

---

## 02. RexCLI 뭐야?

**RexCLI = Claude Code + Codex + Gemini协作**

### 핵심 기능

| 기능 | 의미 |
|------|------|
| 통일 브라우저 자동화 | 어느 CLI든 같은 `browser_*` 명령어 |
|跨CLI 컨텍스트 메모리| 도구 바꿔도 진행 상황 저장 |
| Privacy Guard | 설정 파일 자동 탈敏, API Key 유출 방지 |

### 원리

```
codex/claude/gemini 입력
       ↓
RexCLI가 자동 가로채기
       ↓
판단: 래핑할까 통과시킬까?
       ↓
래핑: ContextDB + Browser MCP 연결
통과: 원본 도구에 직접 전달
```

**작업 습관 바꿀 필요 없음.** 지금까지처럼 쓰면 됨.

---

## 03. 실제 효과

### 효과1: 브라우저自动化

```bash
# 전에: Codex 씀
codex

# 지금: Codex 씀 but 능력 다름
codex
```

차이점은 이제 통일된 `browser_*` 도구能用:
- `browser_navigate` - 페이지 열기
- `browser_click` - 요소 클릭
- `browser_snapshot` - 페이지 콘텐츠 가져오기
- `browser_screenshot` - 스크린샷

**어느 CLI로 바뀌든 이 명령어들 사용 가능.**

### 효과2: 브레이크포인트 续跑

작업의 절반 하고 도구 바꾸면?

```bash
# Codex로 절반 실행
codex

# Claude로 바꿔서 계속, 컨텍스트 자동 동기화
claude
```

**복사＆붙여넣기 필요 없음, 작업 다시 설명 필요 없음.**

---

## 04. 설치 방법

```bash
# 1. 클론
git clone https://github.com/rexleimo/rex-cli.git

# 2. 설치
cd rex-cli
./scripts/setup-all.sh --components all

# 3. 실행
codex
```

홈페이지: [rexai.top](https://rexai.top)
문서: [cli.rexai.top](https://cli.rexai.top)

---

## 05. 왜 오픈소스?

알잖아. 이렇게 많은 도구 있는데 왜 ainda 만드는 거야?

**因为他们，比我 更懂这种"工具分裂"的痛.**

매일 세 개의 도구를 바꿔가며 컨텍스트消失、설정 重复、密钥风险...这些问题折磨了我太久。

与其忍耐，不如自己动手。

**RexCLI는 내 개인 작품，也是我每天都在用的工具。**

---

## 06. 마무리

**RexCLI 不是要替代 Claude Code 或 Codex.**

只是一个"粘合剂"，让现有的工具更好地协同工作。

만약 같은痛점이 있으면試해보세요. 도움이 되면 좋아요해서更多人 구출되길.

**홈페이지: [rexai.top](https://rexai.top)**

질문 있으면? 댓글에.
