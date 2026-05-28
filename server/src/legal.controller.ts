import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Public } from './common/decorators/public.decorator.js';

const pageShell = (title: string, body: string) => `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} | LingoLoop</title>
  <style>
    body {
      margin: 0;
      background: #fbf7f0;
      color: #2e2319;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.65;
    }
    main {
      width: min(760px, calc(100% - 40px));
      margin: 0 auto;
      padding: 48px 0 72px;
    }
    h1 { font-size: 28px; line-height: 1.25; margin: 0 0 8px; }
    h2 { font-size: 18px; margin: 32px 0 8px; }
    p, li { font-size: 15px; }
    .muted { color: #77685b; }
    a { color: #b64c20; font-weight: 700; }
    ul { padding-left: 22px; }
    .table-wrap { overflow-x: auto; margin: 16px 0; }
    table { border-collapse: collapse; min-width: 620px; width: 100%; }
    th, td { border: 1px solid #eadccd; padding: 10px 12px; text-align: left; vertical-align: top; }
    th { background: #f3e8dc; }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const renderInline = (value: string) => {
  const links: { label: string; url: string }[] = [];
  const tokenized = value.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    (_match, label: string, url: string) => {
      const index = links.push({ label, url }) - 1;
      return `@@LINK_${index}@@`;
    },
  );

  return escapeHtml(tokenized)
    .replace(
      /(^|[\s(])((?:https?:\/\/)[^\s<)@]+)/g,
      '$1<a href="$2" rel="noopener noreferrer">$2</a>',
    )
    .replace(
      /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi,
      '<a href="mailto:$1">$1</a>',
    )
    .replace(/@@LINK_(\d+)@@/g, (_match, index: string) => {
      const link = links[Number(index)];
      if (!link) return '';
      return `<a href="${escapeHtml(link.url)}" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`;
    });
};

const renderTable = (lines: string[]) => {
  const rows = lines
    .filter((line) => !/^\|\s*-/.test(line))
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => renderInline(cell.trim())),
    );
  const [head, ...body] = rows;
  return [
    '<div class="table-wrap"><table>',
    head
      ? `<thead><tr>${head.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead>`
      : '',
    body.length
      ? `<tbody>${body
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`,
          )
          .join('')}</tbody>`
      : '',
    '</table></div>',
  ].join('');
};

const renderMarkdown = (markdown: string) => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let table: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    html.push(
      `<ul>${list.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`,
    );
    list = [];
  };
  const flushTable = () => {
    if (!table.length) return;
    html.push(renderTable(table));
    table = [];
  };
  const flushBlocks = () => {
    flushParagraph();
    flushList();
    flushTable();
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushBlocks();
      continue;
    }
    if (line.startsWith('|')) {
      flushParagraph();
      flushList();
      table.push(line);
      continue;
    }
    flushTable();
    if (line.startsWith('- ')) {
      flushParagraph();
      list.push(line.slice(2).trim());
      continue;
    }
    flushList();
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }
    paragraph.push(line);
  }
  flushBlocks();
  return html.join('\n');
};

const readDocument = (relativePath: string) => {
  const candidates = [
    join(process.cwd(), relativePath),
    join(process.cwd(), '..', relativePath),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) return null;
  return readFileSync(path, 'utf8');
};

@Controller()
export class LegalController {
  @Public()
  @Get('privacy')
  privacy(@Res() res: Response) {
    const markdown = readDocument('docs/privacy-policy-ko.md');
    if (markdown) {
      res
        .type('html')
        .send(pageShell('개인정보처리방침', renderMarkdown(markdown)));
      return;
    }

    res.type('html').send(
      pageShell(
        '개인정보처리방침',
        `
        <h1>개인정보처리방침</h1>
        <p class="muted">시행일: 2026년 5월 28일</p>
        <p>LingoLoop는 이용자의 개인정보를 중요하게 생각하며, 서비스 제공에 필요한 범위에서만 개인정보를 처리합니다.</p>

        <h2>수집하는 정보</h2>
        <ul>
          <li>계정 정보: 이메일, 닉네임, 소셜 로그인 식별자</li>
          <li>학습 정보: 목표 언어, 학습 기록, 단어장, 퀴즈 기록, 알림 설정</li>
          <li>구독 정보: 구독 플랜, 스토어 구분, 거래 ID, 구독 만료일, 구매 검증 데이터</li>
          <li>서비스 이용 정보: 앱 실행, 화면 이동, 기능 사용 이벤트, 기기 및 앱 환경 정보</li>
        </ul>

        <h2>이용 목적</h2>
        <p>회원 식별, 학습 기능 제공, 구독 권한 확인, 구매 복원, 알림 발송, 문의 응대, 서비스 개선 및 보안 유지에 사용합니다.</p>

        <h2>외부 서비스</h2>
        <p>서비스 운영을 위해 Firebase, Google AdMob, Apple, Google Play, Kakao 등 외부 서비스가 사용될 수 있으며 각 제공자의 정책에 따라 정보가 처리될 수 있습니다.</p>

        <h2>보관 및 삭제</h2>
        <p>개인정보는 수집 및 이용 목적이 달성될 때까지 보관합니다. 이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다.</p>

        <h2>문의</h2>
        <p>개인정보 관련 문의: <a href="mailto:kjinyz@naver.com">kjinyz@naver.com</a></p>
        `,
      ),
    );
  }

  @Public()
  @Get('terms')
  terms(@Res() res: Response) {
    const markdown = readDocument('docs/terms-of-use-ko.md');
    if (markdown) {
      res.type('html').send(pageShell('이용약관', renderMarkdown(markdown)));
      return;
    }

    res.type('html').send(
      pageShell(
        '이용약관',
        `
        <h1>이용약관 및 EULA</h1>
        <p class="muted">시행일: 2026년 5월 28일</p>
        <p>LingoLoop의 iOS 앱 구독에는 Apple 표준 최종 사용자 사용권 계약(EULA)이 적용됩니다.</p>
        <p><a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">Apple 표준 EULA 보기</a></p>

        <h2>프리미엄 구독</h2>
        <ul>
          <li>상품명: 월간 프리미엄</li>
          <li>기간: 1개월 단위 자동 갱신 구독</li>
          <li>결제: App Store 계정으로 청구됩니다.</li>
          <li>갱신: 현재 구독 기간 종료 최소 24시간 전까지 취소하지 않으면 자동 갱신됩니다.</li>
          <li>관리 및 취소: App Store 계정 설정의 구독 관리 화면에서 할 수 있습니다.</li>
        </ul>

        <h2>문의</h2>
        <p>약관 또는 구독 관련 문의: <a href="mailto:kjinyz@naver.com">kjinyz@naver.com</a></p>
        <p><a href="/privacy">개인정보처리방침 보기</a></p>
        `,
      ),
    );
  }
}
