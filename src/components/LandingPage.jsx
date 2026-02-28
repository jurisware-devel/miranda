import { Button, Col, Flex, Layout, Row, Space, Typography } from 'antd';

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

export default function LandingPage() {
  return (
    <Layout style={{ background: '#fff', minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '20px 24px', height: 'auto' }}>
        <div style={containerStyle}>
          <Flex align="center" justify="space-between" wrap="wrap" gap={16}>
            <Title level={4} style={{ margin: 0 }}>
              Miranda
            </Title>
            <Button type="link" size="large">
              Login
            </Button>
          </Flex>
        </div>
      </Header>

      <Content>
        <section style={sectionStyle}>
          <div style={containerStyle}>
            <Flex vertical align="center" justify="center" style={{ textAlign: 'center', minHeight: '56vh' }}>
              <Space direction="vertical" size={20} style={{ maxWidth: 860 }}>
                <Title level={1} style={{ marginBottom: 0 }}>
                  Clearer Insight into New York Criminal Appeals.
                </Title>
                <Paragraph style={{ fontSize: 18, marginBottom: 0 }}>
                  Concise summaries, structured tags, and searchable opinions from the New York Court of
                  Appeals.
                </Paragraph>
              </Space>

              <Space size="middle" wrap style={{ marginTop: 36 }}>
                <Button type="primary" size="large">
                  Start Researching
                </Button>
                <Button type="link" size="large">
                  Browse Recent Cases
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
              <Button type="primary" size="large">
                Explore the Cases
              </Button>
            </Flex>
          </div>
        </section>
      </Content>
    </Layout>
  );
}
