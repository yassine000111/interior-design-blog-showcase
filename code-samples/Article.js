import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

/**
 * Article Component
 * 
 * A comprehensive article display component for a dynamic blog platform that:
 * - Fetches article data from a headless CMS API
 * - Handles rich content including images, videos, and structured sections
 * - Features responsive design with accessibility considerations
 * - Includes reading progress bar, TOC, and social sharing
 * - Implements SEO optimization techniques
 * 
 * @returns {JSX.Element} The rendered article page
 */
const Article = () => {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const heroRef = useRef(null);
  
  // API configuration - using environment variables for security
  const API_URL = process.env.REACT_APP_API_URL;
  const API_TOKEN = process.env.REACT_APP_API_TOKEN;
  
  /**
   * Calculates the estimated reading time based on word count
   * @param {Object} article - The article object
   * @returns {string} Formatted reading time
   */
  const calculateReadingTime = (article) => {
    if (!article) return "5 min read";
    const wordsPerMinute = 200;
    let totalWords = 0;

    // Process main content
    if (article.content) {
      article.content.forEach(contentBlock => {
        if (contentBlock.children) {
          contentBlock.children.forEach(child => {
            if (child.text) {
              totalWords += child.text.split(/\s+/).length;
            }
          });
        }
      });
    }

    // Process sections
    if (sections && sections.length) {
      sections.forEach(section => {
        if (section.Text) {
          section.Text.forEach(textBlock => {
            if (textBlock.children) {
              textBlock.children.forEach(child => {
                if (child.text) {
                  totalWords += child.text.split(/\s+/).length;
                }
              });
            }
          });
        }
      });
    }

    // Process conclusion
    if (article.conclusion) {
      totalWords += article.conclusion.split(/\s+/).length;
    }

    const minutes = Math.ceil(totalWords / wordsPerMinute);
    return `${minutes} min read (${totalWords} words)`;
  };
  
  /**
   * Renders rich text content by extracting text from structured content blocks
   * @param {Object} richTextBlock - A rich text content block
   * @returns {string} Plain text content
   */
  const renderRichText = (richTextBlock) => {
    if (!richTextBlock) return '';
    if (typeof richTextBlock === 'string') return richTextBlock;
    if (!richTextBlock.children) return '';
    
    return richTextBlock.children.map(child => child.text || '').join(' ');
  };
  
  /**
   * Processes media URLs to ensure proper formatting
   * @param {Object} resource - Media resource object
   * @param {string} externalUrl - Optional external URL
   * @returns {string|null} Formatted URL
   */
  const getMediaUrl = (resource, externalUrl) => {
    // Handle external URL if provided
    if (externalUrl) {
      // Security check for valid URLs
      try {
        const url = new URL(externalUrl);
        return url.toString();
      } catch (e) {
        console.error("Invalid URL:", externalUrl);
        return null;
      }
    }
    
    // Handle resource object from CMS
    if (!resource) return null;
    
    // Handle different CMS response formats
    if (resource.data?.attributes?.url) {
      return new URL(resource.data.attributes.url, API_URL).toString();
    }
    
    if (resource.url) {
      return new URL(resource.url, API_URL).toString();
    }
    
    return null;
  };
  
  /**
   * Checks if a URL is from YouTube
   * @param {string} url - URL to check
   * @returns {boolean} True if YouTube URL
   */
  const isYouTubeUrl = (url) => {
    return url && (
      url.includes('youtube.com') || 
      url.includes('youtu.be')
    );
  };

  /**
   * Extracts YouTube video ID from different URL formats
   * @param {string} url - YouTube URL
   * @returns {string|null} YouTube video ID
   */
  const getYouTubeId = (url) => {
    if (!url) return null;
    
    try {
      // Handle youtu.be format
      if (url.includes('youtu.be/')) {
        return url.split('youtu.be/')[1].split('?')[0];
      }
      
      // Handle youtube.com format
      if (url.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(new URL(url).search);
        return urlParams.get('v');
      }
    } catch (e) {
      console.error("Error parsing YouTube URL:", e);
    }
    
    return null;
  };
  
  // Fetch article data on component mount or slug change
  useEffect(() => {
    const fetchArticleData = async () => {
      setLoading(true);
      if (!slug) return;

      try {
        // First API call to get article data with images and video
        const response = await axios.get(`${API_URL}/articles`, {
          params: {
            populate: ['images', 'video'],
            'filters[slug][$eq]': slug
          },
          headers: { Authorization: `Bearer ${API_TOKEN}` }
        });

        if (response.data.data.length > 0) {
          const articleData = response.data.data[0];
          setArticle(articleData);
          
          // Second API call to get sections data
          const sectionsResponse = await axios.get(`${API_URL}/articles`, {
            params: {
              'populate[Sections][populate]': '*',
              'filters[slug][$eq]': slug
            },
            headers: { Authorization: `Bearer ${API_TOKEN}` }
          });

          if (sectionsResponse.data.data.length > 0) {
            const sectionsData = sectionsResponse.data.data[0].Sections || [];
            setSections(sectionsData);
          }
        } else {
          setError("Article not found");
        }
      } catch (error) {
        console.error("Error loading article:", error);
        setError(`Error loading article: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchArticleData();
  }, [slug, API_URL, API_TOKEN]);

  // Handle scroll events for reading progress and table of contents
  useEffect(() => {
    if (!article) return;
    
    const handleScroll = () => {
      // Update reading progress bar
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      const progressBar = document.getElementById('reading-progress-bar');
      
      if (progressBar) {
        progressBar.style.width = scrolled + "%";
        progressBar.setAttribute('aria-valuenow', scrolled);
      }
      
      // Update active section in TOC
      if (sections?.length > 0) {
        const scrollPosition = window.scrollY + 200;
        
        for (let i = sections.length - 1; i >= 0; i--) {
          const section = document.getElementById(`section-${i}`);
          if (section && section.offsetTop <= scrollPosition) {
            setActiveSection(`section-${i}`);
            break;
          }
        }
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [article, sections]);

  // Back to top button visibility logic
  useEffect(() => {
    if (!article) return;
    
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
      const toggleBackToTopBtn = () => {
        backToTopBtn.classList.toggle('visible', window.pageYOffset > 300);
      };
      
      window.addEventListener('scroll', toggleBackToTopBtn);
      toggleBackToTopBtn(); // Initial check
      
      return () => {
        window.removeEventListener('scroll', toggleBackToTopBtn);
      };
    }
  }, [article]);

  // Loading state UI
  if (loading) {
    return (
      <div className="container" style={{ marginTop: "80px" }}>
        <div className="row">
          <div className="col-12 mb-4">
            <div className="skeleton-loader rounded" style={{ height: "60vh", backgroundColor: "#f0f0f0", animation: "pulse 1.5s infinite" }}></div>
          </div>
          <div className="col-lg-8 mx-auto">
            <div className="skeleton-loader rounded mb-4" style={{ height: "3rem", width: "80%", backgroundColor: "#f0f0f0", animation: "pulse 1.5s infinite" }}></div>
            <div className="skeleton-loader rounded mb-4" style={{ height: "2rem", width: "60%", backgroundColor: "#f0f0f0", animation: "pulse 1.5s infinite" }}></div>
            <div className="skeleton-loader rounded mb-4" style={{ height: "1rem", width: "100%", backgroundColor: "#f0f0f0", animation: "pulse 1.5s infinite" }}></div>
          </div>
        </div>
        <style>{`
          @keyframes pulse {
            0% { opacity: 0.6; }
            50% { opacity: 1; }
            100% { opacity: 0.6; }
          }
        `}</style>
      </div>
    );
  }

  // Error state UI
  if (error) {
    return (
      <div className="container text-center my-5" style={{ marginTop: "80px" }}>
        <div className="alert shadow-sm border-0 p-5" style={{ backgroundColor: "#fff0f0", borderLeft: "4px solid #ff5555" }}>
          <h3 className="mb-3 fw-bold">Oops!</h3>
          <p className="mb-3">{error}</p>
          <button className="btn btn-outline-danger" onClick={() => window.history.back()}>Go Back</button>
        </div>
      </div>
    );
  }

  // Article not found UI
  if (!article) {
    return (
      <div className="container text-center my-5" style={{ marginTop: "80px" }}>
        <div className="alert shadow-sm border-0 p-5" style={{ backgroundColor: "#fffdf0", borderLeft: "4px solid #ffc107" }}>
          <h3 className="mb-3 fw-bold">Article Not Found</h3>
          <p className="mb-3">The article you are looking for doesn't exist or has been removed.</p>
          <button className="btn btn-outline-warning" onClick={() => window.history.back()}>Browse Other Articles</button>
        </div>
      </div>
    );
  }

  // Process article data
  const { title, content } = article;
  const readingTime = calculateReadingTime(article);
  
  // Media processing
  const images = article.images || [];
  const hasHeroImage = images?.length > 0;
  const heroImage = hasHeroImage ? images[0] : null;
  
  const videos = article.video || [];
  const hasMainVideo = videos?.length > 0;
  const mainVideo = hasMainVideo ? videos[0] : null;

  return (
    <div className="article-container" style={{ position: "relative" }}>
      {/* SEO Optimization */}
      <Helmet>
        <title>{title} | Great House Ideas</title>
        <meta name="description" content={content?.[0] ? renderRichText(content[0]).substring(0, 155) : ''} />
        <meta property="og:title" content={title} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={window.location.href} />
        {hasHeroImage && <meta property="og:image" content={getMediaUrl(heroImage, article.imageUrl)} />}
      </Helmet>

      {/* Hero Section with Image Overlay */}
      <div className="position-relative mb-5 hero-section">
        {hasHeroImage || article.imageUrl ? (
          <div className="position-relative overflow-hidden">
            <img
              src={getMediaUrl(heroImage, article.imageUrl)}
              alt={title}
              className="img-fluid w-100"
              style={{ maxHeight: "600px", objectFit: "cover", borderRadius: "var(--border-radius)" }}
              ref={heroRef}
              loading="eager" // Critical above-the-fold image
            />
            <div
              className="position-absolute bottom-0 start-0 w-100 p-4 p-md-5"
              style={{
                background: "linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.7), rgba(0,0,0,0.2))",
                borderRadius: "0 0 var(--border-radius) var(--border-radius)"
              }}
            >
              <div className="container">
                <div className="row">
                  <div className="col-lg-10 mx-auto">
                    <h1 className="text-white mb-3 display-4" style={{ 
                      fontFamily: "'Dancing Script', cursive", 
                      textShadow: "2px 2px 4px rgba(0,0,0,0.5)"
                    }}>
                      {title}
                    </h1>
                    <p className="text-white-50 mb-0">{article.category?.category || "Featured"}</p>
                    <div className="d-flex align-items-center mt-3">
                      <span className="text-white-50 me-4">
                        <i className="bi bi-clock me-1"></i> {readingTime}
                      </span>
                      <span className="text-white-50">
                        <i className="bi bi-calendar3 me-1"></i> {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Recently published'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-primary bg-gradient text-center p-5 rounded">
            <div className="py-5">
              <h1 className="display-4 text-white" style={{ 
                fontFamily: "'Dancing Script', cursive",
                textShadow: "2px 2px 4px rgba(0,0,0,0.3)"
              }}>
                {title}
              </h1>
              <p className="text-white-50 mb-0">{article.category?.category || "Featured"}</p>
              <div className="d-flex justify-content-center mt-3">
                <span className="text-white-50 me-4">
                  <i className="bi bi-clock me-1"></i> {readingTime}
                </span>
                <span className="text-white-50">
                  <i className="bi bi-calendar3 me-1"></i> {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Recently published'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="container my-5">
        <div className="row">
          <div className="col-lg-8 mx-auto">
            {/* Reading progress bar - accessibly implemented */}
            <div className="progress reading-progress" role="progressbar" aria-label="Reading progress">
              <div 
                className="progress-bar reading-bar"
                style={{ width: "0%" }}
                aria-valuenow="0" 
                aria-valuemin="0" 
                aria-valuemax="100"
                id="reading-progress-bar"
              ></div>
            </div>
            
            {/* Table of Contents */}
            {sections && sections.length > 0 && (
              <div className="card shadow-sm mb-5 toc-card">
                <div className="card-body">
                  <h2 className="card-title h5 mb-3 d-flex align-items-center">
                    <i className="bi bi-list-ul me-2 text-primary" aria-hidden="true"></i>
                    In This Article
                  </h2>
                  <nav aria-label="Table of contents">
                    <div className="toc-links">
                      {sections.map((section, index) => (
                        <a 
                          key={index} 
                          href={`#section-${index}`} 
                          className={`toc-link ${activeSection === `section-${index}` ? 'active' : ''}`}
                          aria-current={activeSection === `section-${index}` ? 'true' : 'false'}
                        >
                          <span className="badge toc-badge">{index + 1}</span>
                          <span>{section.Title}</span>
                        </a>
                      ))}
                    </div>
                  </nav>
                </div>
              </div>
            )}
            
            {/* Introduction - Showing the content field since there's no introduction field */}
            {content && content.length > 0 && (
              <div id="introduction" className="lead-paragraph mb-5">
                {content.map((contentBlock, index) => (
                  <p key={index} className="lead" style={{ fontSize: "1.2rem", lineHeight: "1.8" }}>
                    {renderRichText(contentBlock)}
                  </p>
                ))}
              </div>
            )}
            
            {/* Video section - Only show if video exists */}
            {(hasMainVideo || article.videoUrl) && (
              <div className="video-featured mb-5 p-3">
                <h2 className="h4 mb-3 border-bottom pb-2">
                  <i className="bi bi-play-circle-fill me-2 text-primary" aria-hidden="true"></i>
                  Article Overview
                </h2>
                <div className="ratio ratio-16x9 my-4 rounded overflow-hidden shadow-sm">
                  {article.videoUrl && isYouTubeUrl(article.videoUrl) ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${getYouTubeId(article.videoUrl)}`}
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                    ></iframe>
                  ) : (
                    <video 
                      controls 
                      className="w-100"
                      src={getMediaUrl(mainVideo, article.videoUrl)}
                      preload="metadata"
                    >
                      <track kind="captions" src="" label="English" />
                      Your browser does not support the video tag.
                    </video>
                  )}
                </div>
              </div>
            )}
  
            {/* Article sections - Dynamically rendered based on CMS data */}
            {sections && sections.length > 0 &&
              sections.map((section, index) => {
                const isEven = index % 2 === 0;
                
                // Distribute additional images to sections
                let sectionImage = null;
                if (images && images.length > 1) {
                  // Skip the hero image, cycle through remaining images
                  const availableImagesCount = images.length - 1;
                  if (availableImagesCount > 0) {
                    const imageIndex = (index % availableImagesCount) + 1;
                    sectionImage = images[imageIndex];
                  }
                }
                
                // Try to get section's own image if exists
                const hasSectionImage = section.Image;
                const sectionImageUrl = hasSectionImage ? 
                  getMediaUrl(section.Image, section.imageUrl) : 
                  (sectionImage ? getMediaUrl(sectionImage) : null);
                
                return (
                  <section id={`section-${index}`} key={index} className="py-5 border-bottom">
                    <div className="row align-items-center g-5">
                      <div className={`col-lg-6 ${!isEven ? 'order-lg-2' : ''}`}>
                        <div className="pe-lg-4">
                          <h2 className="mb-4 d-flex align-items-center" style={{ fontFamily: "'Playfair Display', serif" }}>
                            <span className="badge toc-badge me-2">{index + 1}</span>
                            {section.Title}
                          </h2>
                          {section.Text && section.Text.map((textBlock, textIndex) => (
                            <p key={textIndex} className="mb-3">
                              {renderRichText(textBlock)}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className={`col-lg-6 ${!isEven ? 'order-lg-1' : ''}`}>
                        {sectionImageUrl && (
                          <div className="position-relative">
                            <img
                              src={sectionImageUrl}
                              alt={section.Title || `Section ${index + 1}`}
                              className="img-fluid rounded shadow"
                              style={{ width: "100%", objectFit: "cover" }}
                              loading="lazy"
                            />
                            {section.ImageCaption && (
                              <p className="text-muted small mt-2 fst-italic">{section.ImageCaption}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Section video - conditionally rendered */}
                    {(section.video || section.videoUrl) && (
                      <div className="mt-4 pt-3">
                        <div className="ratio ratio-16x9 my-4 rounded overflow-hidden shadow-sm">
                          {section.videoUrl && isYouTubeUrl(section.videoUrl) ? (
                            <iframe
                              src={`https://www.youtube.com/embed/${getYouTubeId(section.videoUrl)}`}
                              title={`${section.Title || 'Section'} video`}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              loading="lazy"
                            ></iframe>
                          ) : (
                            <video 
                              controls 
                              className="w-100"
                              src={getMediaUrl(section.video, section.videoUrl)}
                              preload="metadata"
                            >
                              <track kind="captions" src="" label="English" />
                              Your browser does not support the video tag.
                            </video>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })
            }
              
            {/* Conclusion section */}
            {article.conclusion && (
              <div id="conclusion" className="conclusion-section mt-5 pt-3">
                <h2 className="h3 mb-4 conclusion-title">In Conclusion</h2>
                <p style={{ fontSize: "1.1rem", lineHeight: "1.7" }}>{article.conclusion}</p>
                
                {/* Social sharing buttons - with proper security attributes */}
                <div className="social-share-container mt-4 pt-3 border-top">
                  <p className="social-share-title mb-2">Share this article:</p>
                  <div className="d-flex gap-2">
                    <a 
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn social-btn social-btn-fb"
                      aria-label="Share on Facebook"
                    >
                      <i className="bi bi-facebook" aria-hidden="true"></i>
                    </a>
                    <a 
                      href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(title)}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn social-btn social-btn-tw"
                      aria-label="Share on Twitter"
                    >
                      <i className="bi bi-twitter" aria-hidden="true"></i>
                    </a>
                    <a 
                      href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent('Check out this article: ' + window.location.href)}`} 
                      className="btn social-btn social-btn-em"
                      aria-label="Share via Email"
                    >
                      <i className="bi bi-envelope" aria-hidden="true"></i>
                    </a>
                  </div>
                </div>
              </div>
            )}
            
            {/* Back to top button - with accessibility features */}
            <button 
              onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} 
              className="back-to-top"
              id="backToTopBtn"
              aria-label="Back to top"
            >
              <i className="bi bi-arrow-up" aria-hidden="true"></i>
              <span className="visually-hidden">Back to top</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Article;