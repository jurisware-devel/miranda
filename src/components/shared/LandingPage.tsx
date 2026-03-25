import { Button, Col, Flex, Layout, Row, Space, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import projectMirandaLogo from '../../assets/project-miranda-logo.svg';
import { buildCanonicalCasePath } from '../../core/routing/canonicalCaseRouting';
import { normalizeNestedQuotationMarks } from '../../core/utils/quoteTypography';
import { featuredQuotes } from '../../data/featuredQuotes';
import InlineMarkdown from './opinion/InlineMarkdown';

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

const sectionStyle = {
  padding: '88px 24px',
};

const containerStyle = {
  maxWidth: 1100,
  margin: '0 auto',
  width: '100%',
};

const audienceLabels = [
  'Defense Attorneys',
  'Defendants',
  'Prosecutors',
  'Law Enforcement',
  'Parole Officers',
  'Probation Depts',
  'Courts',
  'Judges',
  'Justice Nerds',
  'Students',
];

const shuffleIndices = (length: number, currentIndex?: number) => {
  const indices = Array.from({ length }, (_, index) => index);

  for (let index = indices.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [indices[index], indices[swapIndex]] = [indices[swapIndex], indices[index]];
  }

  if (typeof currentIndex === 'number' && length > 1 && indices[0] === currentIndex) {
    [indices[0], indices[1]] = [indices[1], indices[0]];
  }

  return indices;
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeQuoteIndex, setActiveQuoteIndex] = useState(0);
  const [activeAudienceIndex, setActiveAudienceIndex] = useState(0);
  const shuffledOrderRef = useRef<number[]>(shuffleIndices(featuredQuotes.length));
  const shuffledPointerRef = useRef(0);
  const shuffledAudienceOrderRef = useRef<number[]>(shuffleIndices(audienceLabels.length));
  const shuffledAudiencePointerRef = useRef(0);

  const advanceQuote = (direction: 'prev' | 'next') => {
    if (featuredQuotes.length <= 1) return;

    if (direction === 'next') {
      if (shuffledPointerRef.current >= shuffledOrderRef.current.length - 1) {
        const currentIndex = shuffledOrderRef.current[shuffledPointerRef.current] ?? activeQuoteIndex;
        shuffledOrderRef.current = shuffleIndices(featuredQuotes.length, currentIndex);
        shuffledPointerRef.current = 0;
      } else {
        shuffledPointerRef.current += 1;
      }

      setActiveQuoteIndex(shuffledOrderRef.current[shuffledPointerRef.current] ?? 0);
      return;
    }

    if (shuffledPointerRef.current <= 0) {
      const currentIndex = shuffledOrderRef.current[shuffledPointerRef.current] ?? activeQuoteIndex;
      shuffledOrderRef.current = shuffleIndices(featuredQuotes.length, currentIndex);
      shuffledPointerRef.current = shuffledOrderRef.current.length - 1;
    } else {
      shuffledPointerRef.current -= 1;
    }

    setActiveQuoteIndex(shuffledOrderRef.current[shuffledPointerRef.current] ?? 0);
  };

  const advanceAudience = () => {
    if (audienceLabels.length <= 1) return;

    if (shuffledAudiencePointerRef.current >= shuffledAudienceOrderRef.current.length - 1) {
      const currentIndex =
        shuffledAudienceOrderRef.current[shuffledAudiencePointerRef.current] ?? activeAudienceIndex;
      shuffledAudienceOrderRef.current = shuffleIndices(audienceLabels.length, currentIndex);
      shuffledAudiencePointerRef.current = 0;
    } else {
      shuffledAudiencePointerRef.current += 1;
    }

    setActiveAudienceIndex(shuffledAudienceOrderRef.current[shuffledAudiencePointerRef.current] ?? 0);
  };

  const navigateToBrowse = () => navigate('/pub');
  const activeQuote = featuredQuotes[activeQuoteIndex];
  const activeQuoteText = normalizeNestedQuotationMarks(activeQuote.quote);
  const activeAudienceLabel = audienceLabels[activeAudienceIndex];

  useEffect(() => {
    if (featuredQuotes.length > 0) {
      setActiveQuoteIndex(shuffledOrderRef.current[0] ?? 0);
    }
  }, []);

  useEffect(() => {
    if (audienceLabels.length > 0) {
      setActiveAudienceIndex(shuffledAudienceOrderRef.current[0] ?? 0);
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      advanceQuote('next');
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      advanceAudience();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <Layout style={{ background: '#fff', minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '20px 24px', height: 'auto' }}>
        <div style={containerStyle}>
          <Flex align="center" justify="space-between" wrap="wrap" gap={16}>
            <Title
              level={4}
              style={{ margin: 0, cursor: 'pointer' }}
              onClick={() => navigate('/pub')}
            >
              Miranda
            </Title>
            <Button type="link" size="large" onClick={() => navigate('/pub/login')}>
              Sign In
            </Button>
          </Flex>
        </div>
      </Header>

      <Content>
        <section style={sectionStyle}>
          <div style={containerStyle}>
            <Flex vertical align="center" justify="center" style={{ textAlign: 'center', minHeight: '56vh' }}>
              <Space direction="vertical" size={20} style={{ maxWidth: 860 }}>
                <div
                  className="landing-project-mark"
                  onClick={navigateToBrowse}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigateToBrowse();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <img
                    src={projectMirandaLogo}
                    alt="Project: Miranda"
                    className="landing-project-mark__logo"
                    draggable={false}
                  />
                </div>
              </Space>
              <div className="landing-quote-showcase">
                <div className="landing-quote-showcase__rail">
                  <article key={`${activeQuote.caseName}-${activeQuote.author}`} className="landing-quote-showcase__card">
                    <blockquote className="landing-quote-showcase__quote">
                      “<InlineMarkdown>{activeQuoteText}</InlineMarkdown>”
                    </blockquote>
                    <div className="landing-quote-showcase__meta">
                      <div>
                        <p className="landing-quote-showcase__case">
                          <Link
                            className="landing-quote-showcase__case-link"
                            to={buildCanonicalCasePath(activeQuote.caseId)}
                          >
                            <em>{activeQuote.caseName}</em>
                          </Link>
                        </p>
                        <p className="landing-quote-showcase__citation">
                          {activeQuote.citation}
                          {activeQuote.decisionYear ? ` (${activeQuote.decisionYear})` : ''}
                        </p>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
              <Space direction="vertical" size={20} style={{ maxWidth: 860 }}>
                <Title level={1} style={{ marginBottom: 0 }}>
                  Criminal Case Law for New&nbsp;York
                  <br />
                  <span className="landing-audience-rotator">{activeAudienceLabel}.</span>
                </Title>
                <Paragraph style={{ fontSize: 18, marginBottom: 0 }}>
                  Concise summaries, structured tags, and searchable opinions from SCOTUS, New York Court of
                  Appeals, and more.
                </Paragraph>
              </Space>

              <Space size="middle" wrap style={{ marginTop: 36 }}>
                <Button type="primary" size="large" onClick={() => navigate('/pub/login')}>
                  Create Your Account
                </Button>
                <Button type="link" size="large" onClick={() => navigate('/pub')}>
                  Browse all cases for free
                </Button>
              </Space>
            </Flex>
          </div>
        </section>

        <section style={sectionStyle}>
          <div style={containerStyle}>
            <Row gutter={[48, 40]}>
              <Col xs={24} md={8}>
                <Space direction="vertical" size={12}>
                  <Title level={3} style={{ margin: 0 }}>
                    Concise Summaries
                  </Title>
                  <Paragraph style={{ margin: 0 }}>
                    High-signal, practitioner-focused overviews of key holdings.
                  </Paragraph>
                </Space>
              </Col>

              <Col xs={24} md={8}>
                <Space direction="vertical" size={12}>
                  <Title level={3} style={{ margin: 0 }}>
                    Structured Tagging
                  </Title>
                  <Paragraph style={{ margin: 0 }}>
                    Topic and subtopic organization designed for real-world use.
                  </Paragraph>
                </Space>
              </Col>

              <Col xs={24} md={8}>
                <Space direction="vertical" size={12}>
                  <Title level={3} style={{ margin: 0 }}>
                    Fast Filtering
                  </Title>
                  <Paragraph style={{ margin: 0 }}>
                    Quickly find cases by issue, court, or category.
                  </Paragraph>
                </Space>
              </Col>
            </Row>
          </div>
        </section>

        <section style={{ ...sectionStyle, background: '#f7f7f7' }}>
          <div style={containerStyle}>
            <Flex vertical align="center" style={{ textAlign: 'center' }}>
              <Title level={3}>Built for New York criminal practitioners.</Title>
              <Paragraph style={{ marginBottom: 0 }}>Designed for clarity. Maintained with care.</Paragraph>
            </Flex>
          </div>
        </section>

        <section style={sectionStyle}>
          <div style={containerStyle}>
            <Flex vertical align="center" style={{ textAlign: 'center' }} gap={16}>
              <Title level={2} style={{ marginBottom: 0 }}>
                Ready to begin?
              </Title>
              <Button type="primary" size="large" onClick={() => navigate('/pub')}>
                Explore the Cases
              </Button>
            </Flex>
          </div>
        </section>
      </Content>
    </Layout>
  );
}
