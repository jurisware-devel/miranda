import { Button, Col, Flex, Layout, Row, Space, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import projectMirandaLogo from '../../assets/project-miranda-logo.svg';
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

const featuredQuotes = [
  {
    quote:
      'In resolving questions of statutory interpretation, our "primary consideration . . . is to \'ascertain and give effect to the intention of the Legislature\'" (*People v Galindo*, 38 NY3d 199, 203 [2022] [some internal quotation marks omitted], quoting *Riley v County of Broome*, 95 NY2d 455, 463 [2000]).',
    caseName: 'People v Bay',
    citation: '41 NY3d 200, 211 (2023)',
    author: 'Opinion of the Court',
  },
  {
    quote:
      'The declaration of delinquency is the exclusive procedural mechanism by which the court can toll a probationary period, and no such declaration was filed.',
    caseName: 'People v Curry',
    citation: '2026 NY Slip Op 01448',
    author: 'Wilson, Ch. J.',
  },
  {
    quote:
      'A single, isolated act cannot satisfy the course of conduct element, and the statute clearly states that a "course of conduct" must inflict the requisite extreme physical pain before death.',
    caseName: 'People v Estrella',
    citation: '41 NY3d 514, 520 (2024)',
    author: 'Troutman, J.',
  },
  {
    quote:
      'Where there is any "reasonable possibility that the error contributed to the plea," the conviction must be reversed.',
    caseName: 'People v Robles',
    citation: '42 NY3d 694, 697 (2024)',
    author: 'Garcia, J.',
  },
  {
    quote:
      "We conclude that counsel's failure to object to multiple improper statements constituted a failure to provide meaningful representation, and under the circumstances of this case, denied the defendant the benefit of a fair trial.",
    caseName: 'People v T.P.',
    citation: '2025 NY Slip Op 03642',
    author: 'Halligan, J.',
  },
  {
    quote:
      'Despite what defendant suggests, we never held in *Pastor* that the duty to inquire and the exception to the preservation doctrine that flows from that duty applies to postplea statements made during sentencing.',
    caseName: 'People v Rios',
    citation: '2026 NY Slip Op 00963',
    author: 'Troutman, J.',
  },
  {
    quote:
      "While the People's justifications for the delay are lacking in some respects, balancing all five *Taranovich* factors, we conclude that defendant was not deprived of his constitutional right to a speedy trial.",
    caseName: 'People v Tyson',
    citation: '2026 NY Slip Op 01446',
    author: 'Cannataro, J.',
  },
  {
    quote:
      'Precedent therefore confirms that an out-of-court statement is testimonial when, viewed objectively, all the circumstances indicate its primary purpose was to create an out-of-court substitute for trial testimony.',
    caseName: 'People v Franklin',
    citation: '42 NY3d 157, 164 (2024)',
    author: 'Halligan, J.',
  },
  {
    quote:
      'We hold that Executive Law § 552 is unconstitutional to the extent it empowers the special prosecutor with concurrent prosecutorial authority.',
    caseName: 'People v Viviani',
    citation: '36 NY3d 564, 583 (2021)',
    author: 'Garcia, J.',
  },
  {
    quote:
      'The threshold question, then, is whether the prior incident evidence was relevant to an issue other than propensity. We conclude it was not.',
    caseName: 'People v Telfair',
    citation: '41 NY3d 107, 115 (2023)',
    author: 'Halligan, J.',
  },
  {
    quote:
      "In sum, defendant's proposed reading of Penal Law § 60.12 ignores well-settled rules of statutory interpretation and rests on speculative claims of legislative intent belied by the statutory framework.",
    caseName: 'People v Hernandez',
    citation: '2025 NY Slip Op 05874',
    author: 'Rivera, J.',
  },
  {
    quote:
      'We hold that defendant was improperly subjected to custodial interrogation and that his statement should have been suppressed. We affirm the Appellate Division order, however, because the error was harmless.',
    caseName: 'People v Robinson',
    citation: '2025 NY Slip Op 05871',
    author: 'Cannataro, J.',
  },
  {
    quote:
      "For these reasons, we reject the argument that defendant's due process rights were violated when Supreme Court declined to order a competency hearing before adjudicating him a level two sex offender.",
    caseName: 'People v Watts',
    citation: '42 NY3d 60, 70 (2024)',
    author: 'Cannataro, J.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeQuoteIndex, setActiveQuoteIndex] = useState(0);

  const cycleQuote = (direction: 'prev' | 'next') => {
    setActiveQuoteIndex((currentIndex) => {
      if (direction === 'prev') {
        return currentIndex === 0 ? featuredQuotes.length - 1 : currentIndex - 1;
      }
      return currentIndex === featuredQuotes.length - 1 ? 0 : currentIndex + 1;
    });
  };

  const navigateToBrowse = () => navigate('/pub');
  const activeQuote = featuredQuotes[activeQuoteIndex];

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
                <div className="landing-quote-showcase__header">
                  <div className="landing-quote-showcase__actions" aria-label="Featured opinion quotes navigation">
                    <button
                      type="button"
                      className="landing-quote-showcase__button"
                      onClick={() => cycleQuote('prev')}
                      aria-label="Scroll featured quotes left"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="landing-quote-showcase__button"
                      onClick={() => cycleQuote('next')}
                      aria-label="Scroll featured quotes right"
                    >
                      →
                    </button>
                  </div>
                </div>
                <div className="landing-quote-showcase__rail">
                  <article key={`${activeQuote.caseName}-${activeQuote.author}`} className="landing-quote-showcase__card">
                    <blockquote className="landing-quote-showcase__quote">
                      “<InlineMarkdown>{activeQuote.quote}</InlineMarkdown>”
                    </blockquote>
                    <div className="landing-quote-showcase__meta">
                      <p className="landing-quote-showcase__case"><em>{activeQuote.caseName}</em></p>
                      <p className="landing-quote-showcase__citation">{activeQuote.citation}</p>
                      <p className="landing-quote-showcase__author">{activeQuote.author}</p>
                    </div>
                  </article>
                </div>
              </div>
              <Space direction="vertical" size={20} style={{ maxWidth: 860 }}>
                <Title level={1} style={{ marginBottom: 0 }}>
                  Case Law for New York
                  <br />
                  Criminal Justice Professionals.
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
